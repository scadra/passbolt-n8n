import type {
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import * as openpgp from 'openpgp';
import { v4 as uuidv4 } from 'uuid';

import type {
	PassboltApiCredentials,
	PassboltApiResponse,
	PassboltAuthChallenge,
	PassboltAuthChallengeResponse,
	PassboltContext,
	PassboltResourceType,
	PassboltTokenResponse,
} from './types';
import { CHALLENGE_VERSION, PASSBOLT_API } from './constants';

const CHALLENGE_EXPIRY_SECONDS = 600;

/**
 * Strips trailing slashes from a server URL.
 * Centralises the normalisation that was previously inlined at every credential read site.
 */
function normalizeServerUrl(url: string): string {
	return url.replace(/\/+$/, '');
}
const TOKEN_TTL_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const PAGE_LIMIT = 100;

/**
 * Cached JWT token pair with metadata for TTL-based eviction.
 * @property accessToken - Short-lived Bearer token for API requests.
 * @property refreshToken - Long-lived token used to renew `accessToken`.
 * @property expiresAt - `Date.now()` timestamp after which both tokens are invalid.
 */
interface TokenCache {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

/**
 * In-process JWT cache keyed by `${serverUrl}::${userId}`.
 * Shared across all concurrent executions; evicted lazily on write and periodically.
 */
const tokenCache = new Map<string, TokenCache>();

/**
 * Removes stale entries from {@link tokenCache}.
 * Called periodically so the map does not grow unboundedly in long-running processes.
 * @internal
 */
function evictExpiredTokens(): void {
	const cutoff = Date.now() - TOKEN_TTL_MS;
	for (const [key, entry] of tokenCache) {
		if (entry.expiresAt < cutoff) {
			tokenCache.delete(key);
		}
	}
}

// Evict stale entries every TOKEN_TTL_MS * 2 so the map cannot grow
// unboundedly in long-running n8n worker processes.
setInterval(evictExpiredTokens, TOKEN_TTL_MS * 2).unref();

/**
 * Parses and decrypts an ASCII-armored OpenPGP private key.
 *
 * Line endings are normalized before parsing to tolerate keys pasted with
 * literal `\n` strings or Windows-style CRLF line endings.
 *
 * @param armoredKey - PGP private key in ASCII-armored format.
 * @param passphrase - Passphrase protecting the key.
 * @returns The decrypted `PrivateKey` object ready for crypto operations.
 * @throws If the key armor is malformed or cannot be parsed.
 * @throws If the passphrase is incorrect.
 */
export async function getDecryptedPrivateKey(
	armoredKey: string,
	passphrase: string,
): Promise<openpgp.PrivateKey> {
	const normalized = armoredKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
	const privateKey = await openpgp.readPrivateKey({ armoredKey: normalized });
	return openpgp.decryptKey({ privateKey, passphrase });
}

/**
 * Fetches the Passbolt server's OpenPGP public key via `GET /auth/verify.json`.
 *
 * Routes through `context.helpers.httpRequest` so n8n proxy and SSL settings
 * (e.g. "Ignore SSL Issues") are respected. This function is also the natural
 * probe used by n8n's credential-testing infrastructure.
 *
 * @param context - n8n execution context providing `helpers.httpRequest`.
 * @param serverUrl - Base URL of the Passbolt instance (no trailing slash).
 * @returns The server's parsed OpenPGP public key.
 * @throws If the HTTP request fails or the response body cannot be parsed.
 */
export async function getServerPublicKey(
	context: IExecuteFunctions,
	serverUrl: string,
): Promise<openpgp.Key> {
	const opts: IHttpRequestOptions = {
		method: 'GET',
		url: `${serverUrl}${PASSBOLT_API.AUTH_VERIFY}`,
		headers: { 'Content-Type': 'application/json' },
	};
	const json = (await context.helpers.httpRequest(opts)) as PassboltApiResponse<{
		fingerprint: string;
		keydata: string;
	}>;
	return openpgp.readKey({ armoredKey: json.body.keydata });
}

/**
 * Encrypts a message for the Passbolt server, signed with the user's private key.
 *
 * @param plaintext - The message to encrypt.
 * @param serverPublicKey - Recipient public key (the server's key).
 * @param userPrivateKey - Signing key (the authenticated user's decrypted private key).
 * @returns ASCII-armored PGP message.
 * @throws If encryption or signing fails (e.g. incompatible key types).
 */
export async function encryptForServer(
	plaintext: string,
	serverPublicKey: openpgp.Key,
	userPrivateKey: openpgp.PrivateKey,
): Promise<string> {
	const message = await openpgp.createMessage({ text: plaintext });
	return openpgp.encrypt({
		message,
		encryptionKeys: serverPublicKey,
		signingKeys: userPrivateKey,
	}) as Promise<string>;
}

/**
 * Decrypts an ASCII-armored PGP message using the given private key.
 *
 * @param armoredMessage - The encrypted PGP message to decrypt.
 * @param privateKey - The decrypted private key to use for decryption.
 * @param verificationKey - Optional key used to verify the message signature.
 *        When provided, the decrypted result must carry a valid signature from
 *        this key; otherwise an error is thrown to prevent accepting unsigned
 *        or tampered messages.
 * @returns The decrypted plaintext string.
 * @throws If decryption fails (e.g. wrong key or corrupt message).
 * @throws If `verificationKey` is supplied and the message carries no valid signature.
 */
export async function decryptMessage(
	armoredMessage: string,
	privateKey: openpgp.PrivateKey,
	verificationKey?: openpgp.Key,
): Promise<string> {
	const message = await openpgp.readMessage({ armoredMessage });
	const decryptOptions: openpgp.DecryptOptions & { message: openpgp.Message<string> } = {
		message,
		decryptionKeys: privateKey,
	};
	if (verificationKey) {
		decryptOptions.verificationKeys = verificationKey;
	}

	const { data, signatures } = await openpgp.decrypt(decryptOptions);

	// openpgp v5 returns data as string | ReadableStream. Guard against the
	// streaming case — in practice Passbolt always produces buffered messages,
	// but being explicit avoids a silent runtime cast failure.
	if (typeof data !== 'string') {
		throw new Error('decryptMessage: unexpected streaming response from openpgp.decrypt');
	}

	// When a verification key was supplied, confirm that at least one valid
	// signature exists. This catches unsigned messages and signature mismatches.
	if (verificationKey) {
		if (!signatures || signatures.length === 0) {
			throw new Error(
				'decryptMessage: message carries no signatures but verification was requested',
			);
		}
		for (const sig of signatures) {
			await sig.verified;
		}
	}

	return data;
}

/**
 * Encrypts a message for a Passbolt user, signed with the caller's private key.
 *
 * @param plaintext - The message to encrypt.
 * @param recipientPublicKey - Public key of the intended recipient.
 * @param signingPrivateKey - Signing key (the authenticated user's decrypted private key).
 * @returns ASCII-armored PGP message.
 * @throws If encryption or signing fails (e.g. incompatible key types).
 */
export async function encryptForUser(
	plaintext: string,
	recipientPublicKey: openpgp.Key,
	signingPrivateKey: openpgp.PrivateKey,
): Promise<string> {
	const message = await openpgp.createMessage({ text: plaintext });
	return openpgp.encrypt({
		message,
		encryptionKeys: recipientPublicKey,
		signingKeys: signingPrivateKey,
	}) as Promise<string>;
}

/**
 * Performs a full GPG challenge-response authentication against the Passbolt server
 * and returns a fresh JWT token pair.
 *
 * Steps:
 * 1. Fetch the server's public key (via n8n HTTP helper).
 * 2. Build a JSON challenge containing a random `verify_token` and encrypt it for the server.
 * 3. POST the encrypted challenge to `/auth/jwt/login.json` (via n8n HTTP helper).
 * 4. Decrypt the server's response and verify the `verify_token` matches to prevent MITM.
 *
 * @param context - n8n execution context providing `helpers.httpRequest`.
 * @param serverUrl - Base URL of the Passbolt instance (no trailing slash).
 * @param userId - UUID of the authenticating user.
 * @param privateKey - The user's decrypted OpenPGP private key.
 * @returns A fresh `TokenCache` entry containing access/refresh tokens and expiry.
 * @throws If the login HTTP request fails or the server's `verify_token` does not match.
 */
async function authenticate(
	context: IExecuteFunctions,
	serverUrl: string,
	userId: string,
	privateKey: openpgp.PrivateKey,
): Promise<TokenCache> {
	const serverPublicKey = await getServerPublicKey(context, serverUrl);

	const verifyToken = uuidv4();
	const challengePayload: PassboltAuthChallenge = {
		version: CHALLENGE_VERSION,
		domain: serverUrl,
		verify_token: verifyToken,
		verify_token_expiry: Math.floor(Date.now() / 1000) + CHALLENGE_EXPIRY_SECONDS,
	};
	const encryptedChallenge = await encryptForServer(
		JSON.stringify(challengePayload),
		serverPublicKey,
		privateKey,
	);

	let loginJson: PassboltApiResponse<{ challenge: string }>;
	try {
		const opts: IHttpRequestOptions = {
			method: 'POST',
			url: `${serverUrl}${PASSBOLT_API.AUTH_LOGIN}`,
			headers: { 'Content-Type': 'application/json' },
			body: { user_id: userId, challenge: encryptedChallenge },
		};
		loginJson = (await context.helpers.httpRequest(opts)) as PassboltApiResponse<{
			challenge: string;
		}>;
	} catch (error) {
		// Strip PGP-armored blocks from the error (may contain key material or token data)
		// and truncate to prevent leaking full server responses into logs.
		const rawError = String((error as Error).message ?? error);
		const sanitizedError = rawError
			.replace(/-----BEGIN PGP[^-]*-----[\s\S]*?-----END PGP[^-]*-----/g, '[PGP BLOCK REDACTED]')
			.slice(0, 200);
		throw new NodeOperationError(context.getNode(), `Passbolt auth failed: ${sanitizedError}`);
	}

	const decryptedResponse = await decryptMessage(loginJson.body.challenge, privateKey);
	let responseData: PassboltAuthChallengeResponse;
	try {
		responseData = JSON.parse(decryptedResponse) as PassboltAuthChallengeResponse;
	} catch {
		throw new NodeApiError(context.getNode(), {}, {
			message: 'Server challenge response is not valid JSON after decryption',
		});
	}

	if (responseData.verify_token !== verifyToken) {
		throw new NodeOperationError(context.getNode(), 'Server verify_token mismatch — possible MITM attack');
	}

	return {
		accessToken: responseData.access_token,
		refreshToken: responseData.refresh_token,
		expiresAt: Date.now() + TOKEN_TTL_MS,
	};
}

/**
 * Attempts to obtain a new access token using the stored refresh token.
 *
 * Returns `null` on any failure so the caller can fall through to full re-authentication
 * without surfacing transient network or parse errors.
 *
 * @param context - n8n execution context providing `helpers.httpRequest`.
 * @param serverUrl - Base URL of the Passbolt instance (no trailing slash).
 * @param userId - UUID of the authenticating user.
 * @param refreshToken - The current refresh token.
 * @returns A fresh `TokenCache` entry, or `null` if the refresh failed.
 */
async function refreshAccessToken(
	context: IExecuteFunctions,
	serverUrl: string,
	userId: string,
	refreshToken: string,
): Promise<TokenCache | null> {
	try {
		// Passbolt's JWT refresh endpoint expects the refresh token in the
		// Authorization header as `Bearer <refresh_token>`, not in the request
		// body. This is a Passbolt-specific convention documented in their API
		// (https://www.passbolt.com/docs/api/authentication) and is intentional,
		// not a mistake. Do not move the token to the body.
		const opts: IHttpRequestOptions = {
			method: 'POST',
			url: `${serverUrl}${PASSBOLT_API.AUTH_REFRESH}`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`,
			},
			body: { user_id: userId },
		};
		// httpRequest throws on non-2xx, which the outer catch converts to null.
		const json = (await context.helpers.httpRequest(
			opts,
		)) as PassboltApiResponse<PassboltTokenResponse>;
		return {
			accessToken: json.body.access_token,
			refreshToken: json.body.refresh_token,
			expiresAt: Date.now() + TOKEN_TTL_MS,
		};
	} catch {
		return null;
	}
}

/**
 * Resolves a valid JWT access token using a 3-tier strategy:
 * 1. Return the cached token if it has not expired (minus a buffer).
 * 2. Attempt a silent refresh using the stored refresh token.
 * 3. Fall back to a full GPG challenge-response authentication.
 *
 * @param context - n8n execution context threaded through to all HTTP helpers.
 * @param serverUrl - Base URL of the Passbolt instance (no trailing slash).
 * @param userId - UUID of the authenticating user.
 * @param privateKey - The user's decrypted OpenPGP private key (used only for full auth).
 * @returns A valid JWT access token string.
 */
async function getAccessToken(
	context: IExecuteFunctions,
	serverUrl: string,
	userId: string,
	privateKey: openpgp.PrivateKey,
): Promise<string> {
	const cacheKey = `${serverUrl}::${userId}`;
	const cached = tokenCache.get(cacheKey);

	if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
		return cached.accessToken;
	}

	if (cached?.refreshToken) {
		const refreshed = await refreshAccessToken(context, serverUrl, userId, cached.refreshToken);
		if (refreshed) {
			tokenCache.set(cacheKey, refreshed);
			return refreshed.accessToken;
		}
	}

	const tokens = await authenticate(context, serverUrl, userId, privateKey);
	tokenCache.set(cacheKey, tokens);
	return tokens.accessToken;
}

/**
 * Makes an authenticated HTTP request to the Passbolt API.
 *
 * Reads credentials from the n8n credential store, decrypts the private key,
 * and acquires a JWT access token (via cache, refresh, or full GPG auth).
 * All HTTP — including auth — goes through `this.helpers.httpRequest` so n8n
 * proxy and SSL settings are respected end-to-end.
 *
 * @this {IExecuteFunctions} n8n execution context used for credential access and HTTP.
 * @param method - HTTP method (GET, POST, PUT, DELETE, …).
 * @param endpoint - API path including leading slash (e.g. `/resources.json`).
 * @param body - Optional request body (omitted when empty).
 * @param qs - Optional query-string parameters.
 * @returns The parsed JSON response body.
 * @throws `NodeApiError` on any HTTP or network failure.
 */
export async function passboltApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: object,
	qs?: Record<string, string | number | boolean>,
	ctx?: PassboltContext,
): Promise<JsonObject> {
	let serverUrl: string;
	let userId: string;
	let privateKey: openpgp.PrivateKey;

	if (ctx) {
		serverUrl = ctx.serverUrl;
		userId = ctx.userId;
		privateKey = ctx.privateKey;
	} else {
		const credentials = await this.getCredentials<PassboltApiCredentials>('passboltApi');
		serverUrl = normalizeServerUrl(credentials.serverUrl);
		userId = credentials.userId;
		privateKey = await getDecryptedPrivateKey(credentials.privateKey, credentials.passphrase);
	}

	const accessToken = await getAccessToken(this, serverUrl, userId, privateKey);

	const opts: IHttpRequestOptions = {
		method,
		url: `${serverUrl}${endpoint}`,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		qs: qs ?? {},
	};

	if (body && Object.keys(body).length > 0) {
		opts.body = body;
	}

	try {
		return (await this.helpers.httpRequest(opts)) as JsonObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Fetches all pages of a paginated Passbolt API endpoint.
 *
 * Iterates using `page` + `limit=PAGE_LIMIT` query parameters until a page
 * returns fewer items than the limit, indicating the last page.
 * Must be called with `.call(this, ...)` from an `IExecuteFunctions` context.
 *
 * @this {IExecuteFunctions} n8n execution context forwarded to `passboltApiRequest`.
 * @param method - HTTP method (typically GET).
 * @param endpoint - API path including leading slash.
 * @param body - Optional request body object.
 * @param qs - Optional base query-string parameters (`page` and `limit` are managed internally).
 * @returns Flat array of all items across all pages.
 * @throws `NodeApiError` on any HTTP or network failure.
 */
export async function passboltApiRequestAllItems(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: object,
	qs?: Record<string, string | number | boolean>,
	ctx?: PassboltContext,
): Promise<JsonObject[]> {
	const allQs = { ...qs };
	let page = 1;
	const limit = PAGE_LIMIT;
	const allItems: JsonObject[] = [];

	let hasMore = true;
	while (hasMore) {
		allQs['page'] = page;
		allQs['limit'] = limit;
		const response = (await passboltApiRequest.call(this, method, endpoint, body, allQs, ctx)) as
			| JsonObject[]
			| JsonObject;

		const items = Array.isArray(response) ? response : [response];
		allItems.push(...items);

		if (items.length < limit) {
			hasMore = false;
		} else {
			page++;
		}
	}

	return allItems;
}

/**
 * Decrypts a Passbolt secret using the credentials stored in n8n.
 *
 * Reads the private key and passphrase from the `passboltApi` credential.
 * Must be called with `.call(this, ...)` from an `IExecuteFunctions` context.
 *
 * @this {IExecuteFunctions} n8n execution context used for credential access.
 * @param encryptedData - ASCII-armored PGP message to decrypt.
 * @returns Decrypted plaintext (typically a JSON string for modern resource types).
 * @throws If the private key passphrase is wrong, the key is malformed, or decryption fails.
 */
export async function decryptSecret(
	this: IExecuteFunctions,
	encryptedData: string,
): Promise<string> {
	const credentials = await this.getCredentials<PassboltApiCredentials>('passboltApi');
	const privateKey = await getDecryptedPrivateKey(credentials.privateKey, credentials.passphrase);
	return decryptMessage(encryptedData, privateKey);
}

/**
 * Encrypts a secret for a specific Passbolt user.
 *
 * Reads the caller's private key from n8n credentials for signing, then
 * encrypts the message with the recipient's armored public key.
 * Must be called with `.call(this, ...)` from an `IExecuteFunctions` context.
 *
 * @this {IExecuteFunctions} n8n execution context used for credential access.
 * @param plaintext - The secret text to encrypt (typically a JSON string).
 * @param recipientArmoredPublicKey - ASCII-armored OpenPGP public key of the recipient.
 * @returns ASCII-armored PGP message encrypted for the recipient.
 * @throws If the private key passphrase is wrong, either key is malformed, or encryption fails.
 */
export async function encryptSecretForUser(
	this: IExecuteFunctions,
	plaintext: string,
	recipientArmoredPublicKey: string,
): Promise<string> {
	const credentials = await this.getCredentials<PassboltApiCredentials>('passboltApi');
	const privateKey = await getDecryptedPrivateKey(credentials.privateKey, credentials.passphrase);
	const recipientPublicKey = await openpgp.readKey({ armoredKey: recipientArmoredPublicKey });
	return encryptForUser(plaintext, recipientPublicKey, privateKey);
}

/**
 * Encrypts a secret for the authenticated user themselves.
 *
 * Derives the public key from the user's own private key so that the secret
 * can be stored and later decrypted by the same user.
 * Must be called with `.call(this, ...)` from an `IExecuteFunctions` context.
 *
 * @this {IExecuteFunctions} n8n execution context used for credential access.
 * @param plaintext - The secret text to encrypt (typically a JSON string).
 * @returns ASCII-armored PGP message encrypted for self.
 * @throws If the private key passphrase is wrong, the key is malformed, or encryption fails.
 */
export async function encryptSecretForSelf(
	this: IExecuteFunctions,
	plaintext: string,
): Promise<string> {
	const credentials = await this.getCredentials<PassboltApiCredentials>('passboltApi');
	const privateKey = await getDecryptedPrivateKey(credentials.privateKey, credentials.passphrase);
	const publicKey = privateKey.toPublic();
	return encryptForUser(plaintext, publicKey, privateKey);
}

/**
 * Reads the `passboltApi` credential once, decrypts the private key, and
 * returns a `PassboltContext` that can be forwarded to subsequent API calls
 * to avoid repeated key decryptions within the same handler invocation.
 *
 * @param ef - n8n execution context providing credential access.
 * @returns A fully resolved `PassboltContext`.
 */
export async function getCredentialsAndPrivateKey(ef: IExecuteFunctions): Promise<PassboltContext> {
	const credentials = await ef.getCredentials<PassboltApiCredentials>('passboltApi');
	const serverUrl = normalizeServerUrl(credentials.serverUrl);
	const privateKey = await getDecryptedPrivateKey(credentials.privateKey, credentials.passphrase);
	return { serverUrl, userId: credentials.userId, privateKey };
}

/**
 * Decrypts a Passbolt secret using an already-resolved `PassboltContext`.
 *
 * @param encryptedData - ASCII-armored PGP message to decrypt.
 * @param ctx - Pre-resolved context containing the decrypted private key.
 * @returns Decrypted plaintext string.
 */
export async function decryptSecretWithCtx(
	encryptedData: string,
	ctx: PassboltContext,
): Promise<string> {
	return decryptMessage(encryptedData, ctx.privateKey);
}

/**
 * Encrypts a secret for the authenticated user using an already-resolved context.
 *
 * @param plaintext - The secret text to encrypt.
 * @param ctx - Pre-resolved context containing the decrypted private key.
 * @returns ASCII-armored PGP message encrypted for self.
 */
export async function encryptSecretForSelfWithCtx(
	plaintext: string,
	ctx: PassboltContext,
): Promise<string> {
	const publicKey = ctx.privateKey.toPublic();
	return encryptForUser(plaintext, publicKey, ctx.privateKey);
}

/**
 * Encrypts a secret for a specific user using an already-resolved context.
 *
 * @param plaintext - The secret text to encrypt.
 * @param recipientArmoredPublicKey - ASCII-armored OpenPGP public key of the recipient.
 * @param ctx - Pre-resolved context providing the signing private key.
 * @returns ASCII-armored PGP message encrypted for the recipient.
 */
export async function encryptSecretForUserWithCtx(
	plaintext: string,
	recipientArmoredPublicKey: string,
	ctx: PassboltContext,
): Promise<string> {
	const recipientPublicKey = await openpgp.readKey({ armoredKey: recipientArmoredPublicKey });
	return encryptForUser(plaintext, recipientPublicKey, ctx.privateKey);
}

/**
 * Resolves the UUID of a Passbolt resource type by its slug.
 *
 * Fetches all resource types from `/resource-types.json` and returns the `id`
 * of the entry whose `slug` matches the given value.
 * Must be called with `.call(this, ...)` from an `IExecuteFunctions` context.
 *
 * @this {IExecuteFunctions} n8n execution context forwarded to `passboltApiRequest`.
 * @param slug - Resource type slug (e.g. `'password-and-description'`).
 * @returns The UUID of the matching resource type.
 * @throws If no resource type with the given slug exists on the server.
 * @throws `NodeApiError` if the HTTP request to `/resource-types.json` fails.
 */
export async function getResourceTypeId(
	this: IExecuteFunctions,
	slug: string,
	ctx?: PassboltContext,
): Promise<string> {
	const types = (await passboltApiRequest.call(
		this,
		'GET',
		PASSBOLT_API.RESOURCE_TYPES,
		undefined,
		undefined,
		ctx,
	)) as unknown as PassboltResourceType[];

	const matched = types.find((t) => t.slug === slug);
	if (!matched) {
		throw new NodeOperationError(this.getNode(), `Resource type "${slug}" not found`);
	}
	return matched.id;
}

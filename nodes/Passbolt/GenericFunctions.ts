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

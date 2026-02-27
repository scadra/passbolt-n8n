/**
 * JWT login challenge payload sent by the client.
 * @property verify_token - Must be returned by the server to prevent MITM.
 * @property verify_token_expiry - Unix timestamp; challenge expires after this.
 */
export interface PassboltAuthChallenge {
	version: string;
	domain: string;
	verify_token: string;
	verify_token_expiry: number;
}

/**
 * Server response after successful GPG challenge-response login.
 * `verify_token` must match the challenge sent by the client.
 */
export interface PassboltAuthChallengeResponse {
	access_token: string;
	refresh_token: string;
	verify_token: string;
}

/**
 * Token pair returned by the JWT refresh endpoint.
 * Distinct from {@link PassboltAuthChallengeResponse}: no `verify_token` field.
 */
export interface PassboltTokenResponse {
	access_token: string;
	refresh_token: string;
}

/**
 * Standard Passbolt API response envelope.
 * @template T - Shape of the `body` payload.
 */
export interface PassboltApiResponse<T> {
	body: T;
	header?: unknown;
}

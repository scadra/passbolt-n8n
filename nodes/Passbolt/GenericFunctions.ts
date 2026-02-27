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

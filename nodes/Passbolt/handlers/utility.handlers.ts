import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import { getCredentialsAndPrivateKey, decryptMessage } from '../GenericFunctions';
import { Param } from './utils';
import type { PassboltContext } from '../types';

/**
 * Standalone utility: decrypts an arbitrary PGP-encrypted string using the
 * credentials stored in n8n.
 *
 * Returns the parsed JSON object if the decrypted text is valid JSON,
 * otherwise returns `{ decryptedText }`.
 */
export async function decrypt(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const encryptedData = this.getNodeParameter(Param.ENCRYPTED_DATA, i) as string;
	const ctx: PassboltContext = await getCredentialsAndPrivateKey(this);
	const decryptedText = await decryptMessage(encryptedData, ctx.privateKey);
	try {
		return JSON.parse(decryptedText) as JsonObject;
	} catch {
		return { decryptedText };
	}
}

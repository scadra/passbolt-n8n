import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import {
	passboltApiRequest,
	passboltApiRequestAllItems,
	getCredentialsAndPrivateKey,
	decryptSecretWithCtx,
	encryptSecretForSelfWithCtx,
	getResourceTypeId,
} from '../GenericFunctions';
import type { PassboltResource } from '../types';
import {
	DELETE_SUCCESS,
	DECRYPTION_FAILED_SENTINEL,
	PASSBOLT_API,
	PASSBOLT_CONTAIN,
	ResourceTypeSlug,
	HttpMethod,
} from '../constants';
import { Param } from './utils';

/**
 * Fetches a single Passbolt resource by ID and decrypts its secret.
 *
 * Requests the resource with `contain[secret]=1`, then decrypts the first
 * secret entry and attaches it as `secret_clear`.
 */
export async function resourceGet(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const ctx = await getCredentialsAndPrivateKey(this);
	const resourceId = this.getNodeParameter(Param.RESOURCE_ID, i) as string;

	const resource = (await passboltApiRequest.call(
		this,
		HttpMethod.GET,
		PASSBOLT_API.RESOURCE(resourceId),
		undefined,
		PASSBOLT_CONTAIN.secret,
		ctx,
	)) as PassboltResource;

	const firstSecret = resource.secrets?.[0];
	if (firstSecret) {
		const decrypted = await decryptSecretWithCtx(firstSecret.data, ctx);
		try {
			resource.secret_clear = JSON.parse(decrypted) as PassboltResource['secret_clear'];
		} catch {
			resource.secret_clear = decrypted;
		}
	}

	return resource as JsonObject;
}

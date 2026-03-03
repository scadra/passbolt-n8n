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

/**
 * Fetches all (or a capped number of) Passbolt resources with decrypted secrets.
 *
 * All secrets are decrypted in parallel via `Promise.all`. Each decryption
 * catches its own errors so that one undecryptable entry does not abort the
 * remaining results — those entries receive `secret_clear: DECRYPTION_FAILED_SENTINEL`.
 */
export async function resourceGetAll(this: IExecuteFunctions, i: number): Promise<JsonObject[]> {
	const ctx = await getCredentialsAndPrivateKey(this);
	const returnAll = this.getNodeParameter(Param.RETURN_ALL, i);
	const filters = this.getNodeParameter(Param.FILTERS, i) as Record<
		string,
		string | number | boolean
	>;
	const qs: Record<string, string | number | boolean> = {
		...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== false)),
		...PASSBOLT_CONTAIN.secret,
	};

	let resources: PassboltResource[];
	if (returnAll) {
		resources = (await passboltApiRequestAllItems.call(
			this,
			HttpMethod.GET,
			PASSBOLT_API.RESOURCES,
			undefined,
			qs,
			ctx,
		)) as PassboltResource[];
	} else {
		const limit = this.getNodeParameter(Param.LIMIT, i);
		qs['limit'] = limit;
		const response = (await passboltApiRequest.call(
			this,
			HttpMethod.GET,
			PASSBOLT_API.RESOURCES,
			undefined,
			qs,
			ctx,
		)) as PassboltResource | PassboltResource[];
		resources = (Array.isArray(response) ? response : [response]).slice(0, limit);
	}

	await Promise.all(
		resources.map(async (resource) => {
			const firstSecret = resource.secrets?.[0];
			if (!firstSecret) return;

			try {
				const decrypted = await decryptSecretWithCtx(firstSecret.data, ctx);
				try {
					resource.secret_clear = JSON.parse(decrypted) as PassboltResource['secret_clear'];
				} catch {
					resource.secret_clear = decrypted;
				}
			} catch {
				// One undecryptable secret must not abort the entire result set.
				resource.secret_clear = DECRYPTION_FAILED_SENTINEL;
			}
		}),
	);

	return resources as JsonObject[];
}

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
 * Creates a new Passbolt resource (password entry).
 *
 * Encodes the secret as `{ password, description }` JSON, self-encrypts it,
 * and POSTs to `/resources.json`. Requires the `password-and-description`
 * resource type to be available on the server.
 */
export async function resourceCreate(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const ctx = await getCredentialsAndPrivateKey(this);

	const name = this.getNodeParameter(Param.NAME, i) as string;
	const password = this.getNodeParameter(Param.PASSWORD, i) as string;
	const additionalFields = this.getNodeParameter(Param.ADDITIONAL_FIELDS, i) as {
		description?: string;
		folder_parent_id?: string;
		uri?: string;
		username?: string;
	};

	const resourceTypeId = await getResourceTypeId.call(
		this,
		ResourceTypeSlug.PASSWORD_AND_DESCRIPTION,
		ctx,
	);

	const secretPayload = JSON.stringify({
		password,
		description: additionalFields.description ?? '',
	});

	const encryptedSecret = await encryptSecretForSelfWithCtx(secretPayload, ctx);

	const body: Record<string, unknown> = {
		name,
		resource_type_id: resourceTypeId,
		secrets: [{ data: encryptedSecret }],
	};
	if (additionalFields.uri) body.uri = additionalFields.uri;
	if (additionalFields.username) body.username = additionalFields.username;
	if (additionalFields.folder_parent_id) {
		body.folder_parent_id = additionalFields.folder_parent_id;
	}

	return passboltApiRequest.call(this, HttpMethod.POST, PASSBOLT_API.RESOURCES, body, undefined, ctx);
}

/** Deletes a Passbolt resource by ID. */
export async function resourceDelete(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const resourceId = this.getNodeParameter(Param.RESOURCE_ID, i) as string;
	await passboltApiRequest.call(this, HttpMethod.DELETE, PASSBOLT_API.RESOURCE(resourceId));
	return DELETE_SUCCESS;
}

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

/**
 * Updates an existing Passbolt resource.
 *
 * When `password` is provided, fetches the existing resource to preserve the
 * current description (if not explicitly overridden), re-encrypts the secret,
 * and includes it in the PUT body.
 */
export async function resourceUpdate(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const ctx = await getCredentialsAndPrivateKey(this);
	const resourceId = this.getNodeParameter(Param.RESOURCE_ID, i) as string;
	const updateFields = this.getNodeParameter(Param.UPDATE_FIELDS, i) as {
		name?: string;
		description?: string;
		password?: string;
		uri?: string;
		username?: string;
	};

	const body: Record<string, unknown> = {};
	if (updateFields.name) body.name = updateFields.name;
	if (updateFields.uri) body.uri = updateFields.uri;
	if (updateFields.username) body.username = updateFields.username;

	if (updateFields.password) {
		const existing = await passboltApiRequest.call(
			this,
			HttpMethod.GET,
			PASSBOLT_API.RESOURCE(resourceId),
			undefined,
			undefined,
			ctx,
		);

		const secretPayload = JSON.stringify({
			password: updateFields.password,
			description: updateFields.description ?? (existing.description as string) ?? '',
		});

		const encryptedSecret = await encryptSecretForSelfWithCtx(secretPayload, ctx);
		body.secrets = [{ data: encryptedSecret }];
	}

	return passboltApiRequest.call(
		this,
		HttpMethod.PUT,
		PASSBOLT_API.RESOURCE(resourceId),
		body,
		undefined,
		ctx,
	);
}

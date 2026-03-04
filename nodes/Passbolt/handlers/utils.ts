import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import { passboltApiRequest, passboltApiRequestAllItems } from '../GenericFunctions';
import type { PassboltContext } from '../types';
import { HttpMethod } from '../constants';

/** n8n node parameter name constants to avoid repeated magic strings. */
export enum Param {
	// pagination
	RETURN_ALL = 'returnAll',
	LIMIT = 'limit',
	FILTERS = 'filters',
	// node-level
	RESOURCE = 'resource',
	OPERATION = 'operation',
	// shared across resources
	NAME = 'name',
	ADDITIONAL_FIELDS = 'additionalFields',
	UPDATE_FIELDS = 'updateFields',
	// resource
	RESOURCE_ID = 'resourceId',
	PASSWORD = 'password',
	// folder
	FOLDER_ID = 'folderId',
	// user
	USER_ID = 'userId',
	// group
	GROUP_ID = 'groupId',
	// share
	SHARE_WITH = 'shareWith',
	PERMISSION_TYPE = 'permissionType',
	SHARE_USER_ID = 'shareUserId',
	SHARE_GROUP_ID = 'shareGroupId',
	// utility
	ENCRYPTED_DATA = 'encryptedData',
}

/**
 * Reads the `filters` node parameter for item `i` and returns a query-string
 * object with empty strings and `false` values removed.
 */
export function buildFiltersQs(
	this: IExecuteFunctions,
	i: number,
): Record<string, string | number | boolean> {
	const filters = this.getNodeParameter(Param.FILTERS, i) as Record<
		string,
		string | number | boolean
	>;
	return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== false));
}

/**
 * Fetches a list from a paginated Passbolt endpoint, honouring `returnAll` / `limit`.
 *
 * When `returnAll` is true, delegates to `passboltApiRequestAllItems`.
 * Otherwise, fires a single request and slices the result to `limit`.
 *
 * @param i        - n8n item index.
 * @param endpoint - API path (e.g. `/folders.json`).
 * @param baseQs   - Base query-string params (filters, contains, …).
 * @param ctx      - Optional pre-resolved PassboltContext.
 */
export async function fetchList(
	this: IExecuteFunctions,
	i: number,
	endpoint: string,
	baseQs: Record<string, string | number | boolean>,
	ctx?: PassboltContext,
): Promise<JsonObject[]> {
	const returnAll = this.getNodeParameter(Param.RETURN_ALL, i);

	if (returnAll) {
		return passboltApiRequestAllItems.call(this, HttpMethod.GET, endpoint, undefined, baseQs, ctx);
	}

	const limit = this.getNodeParameter(Param.LIMIT, i);
	const qs = { ...baseQs, limit };
	const response = (await passboltApiRequest.call(
		this,
		HttpMethod.GET,
		endpoint,
		undefined,
		qs,
		ctx,
	)) as unknown as JsonObject[];
	return (Array.isArray(response) ? response : [response]).slice(0, limit);
}

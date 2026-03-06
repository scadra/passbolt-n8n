import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import { passboltApiRequest } from '../GenericFunctions';
import { PASSBOLT_API, HttpMethod } from '../constants';
import { buildFiltersQs, fetchList, Param } from './utils';

export async function userGet(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const userId = this.getNodeParameter(Param.USER_ID, i) as string;
	return passboltApiRequest.call(this, HttpMethod.GET, PASSBOLT_API.USER(userId));
}

export async function userGetAll(this: IExecuteFunctions, i: number): Promise<JsonObject[]> {
	const qs = buildFiltersQs.call(this, i);
	return fetchList.call(this, i, PASSBOLT_API.USERS, qs);
}

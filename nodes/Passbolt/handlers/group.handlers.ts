import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import { passboltApiRequest } from '../GenericFunctions';
import { PASSBOLT_API, HttpMethod } from '../constants';
import { buildFiltersQs, fetchList, Param } from './utils';

export async function groupGet(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const groupId = this.getNodeParameter(Param.GROUP_ID, i) as string;
	return passboltApiRequest.call(this, HttpMethod.GET, PASSBOLT_API.GROUP(groupId));
}

export async function groupGetAll(this: IExecuteFunctions, i: number): Promise<JsonObject[]> {
	const qs = buildFiltersQs.call(this, i);
	return fetchList.call(this, i, PASSBOLT_API.GROUPS, qs);
}

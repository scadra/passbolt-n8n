import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import { passboltApiRequest } from '../GenericFunctions';
import { DELETE_SUCCESS, PASSBOLT_API, HttpMethod } from '../constants';
import { buildFiltersQs, fetchList, Param } from './utils';

export async function folderGet(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const folderId = this.getNodeParameter(Param.FOLDER_ID, i) as string;
	return passboltApiRequest.call(this, HttpMethod.GET, PASSBOLT_API.FOLDER(folderId));
}

export async function folderGetAll(this: IExecuteFunctions, i: number): Promise<JsonObject[]> {
	const qs = buildFiltersQs.call(this, i);
	return fetchList.call(this, i, PASSBOLT_API.FOLDERS, qs);
}

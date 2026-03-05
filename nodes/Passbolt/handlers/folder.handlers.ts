import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';

import { passboltApiRequest } from '../GenericFunctions';
import { DELETE_SUCCESS, PASSBOLT_API, HttpMethod } from '../constants';
import { buildFiltersQs, fetchList, Param } from './utils';

export async function folderCreate(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const name = this.getNodeParameter(Param.NAME, i) as string;
	const additionalFields = this.getNodeParameter(Param.ADDITIONAL_FIELDS, i) as {
		folder_parent_id?: string;
	};
	const body: Record<string, string> = { name };
	if (additionalFields.folder_parent_id) {
		body.folder_parent_id = additionalFields.folder_parent_id;
	}
	return passboltApiRequest.call(this, HttpMethod.POST, PASSBOLT_API.FOLDERS, body);
}

export async function folderDelete(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const folderId = this.getNodeParameter(Param.FOLDER_ID, i) as string;
	await passboltApiRequest.call(this, HttpMethod.DELETE, PASSBOLT_API.FOLDER(folderId));
	return DELETE_SUCCESS;
}

export async function folderGet(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const folderId = this.getNodeParameter(Param.FOLDER_ID, i) as string;
	return passboltApiRequest.call(this, HttpMethod.GET, PASSBOLT_API.FOLDER(folderId));
}

export async function folderGetAll(this: IExecuteFunctions, i: number): Promise<JsonObject[]> {
	const qs = buildFiltersQs.call(this, i);
	return fetchList.call(this, i, PASSBOLT_API.FOLDERS, qs);
}

export async function folderUpdate(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const folderId = this.getNodeParameter(Param.FOLDER_ID, i) as string;
	const updateFields = this.getNodeParameter(Param.UPDATE_FIELDS, i) as Record<string, string>;
	return passboltApiRequest.call(this, HttpMethod.PUT, PASSBOLT_API.FOLDER(folderId), updateFields);
}

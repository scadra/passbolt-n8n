import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { resourceCreate, resourceDelete, resourceGet, resourceGetAll, resourceUpdate } from './handlers/resource.handlers';
import { folderCreate, folderDelete, folderGet, folderGetAll, folderUpdate } from './handlers/folder.handlers';
import { userGet, userGetAll } from './handlers/user.handlers';
import { groupGet, groupGetAll } from './handlers/group.handlers';

import { resourceOperations, resourceFields } from './descriptions/ResourceDescription';
import { folderOperations, folderFields } from './descriptions/FolderDescription';
import { userOperations, userFields } from './descriptions/UserDescription';
import { groupOperations, groupFields } from './descriptions/GroupDescription';
import { Resource } from './constants';
import { Param } from './handlers/utils';

/** Type signature for per-item operation handlers. */
type HandlerFn = (this: IExecuteFunctions, i: number) => Promise<JsonObject | JsonObject[]>;

/**
 * n8n community node integrating the Passbolt password manager API.
 * Supports CRUD on resources, folders, users, and groups; sharing; and GPG utilities.
 * @see https://www.passbolt.com/docs/api
 */
export class Passbolt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Passbolt',
		name: 'passbolt',
		icon: 'file:passbolt.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Interact with the Passbolt password manager API',
		documentationUrl: 'https://gitlab.com/switch-case/passbolt-n8n',
		usableAsTool: true,
		defaults: {
			name: 'Passbolt',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'passboltApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Folder', value: Resource.FOLDER },
					{ name: 'Group', value: Resource.GROUP },
					{ name: 'Password (Resource)', value: Resource.RESOURCE },
					{ name: 'User', value: Resource.USER },
				],
				default: Resource.RESOURCE,
			},
			...resourceOperations,
			...resourceFields,
			...folderOperations,
			...folderFields,
			...userOperations,
			...userFields,
			...groupOperations,
			...groupFields,
		],
	};

	/**
	 * Executes the node for all input items, dispatching by resource + operation.
	 * Uses `continueOnFail()` to allow partial success on item-level errors.
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter(Param.RESOURCE, 0);
		const operation = this.getNodeParameter(Param.OPERATION, 0);

		const handlers: Record<string, Record<string, HandlerFn>> = {
			[Resource.RESOURCE]: {
				create: resourceCreate,
				delete: resourceDelete,
				get: resourceGet,
				getAll: resourceGetAll,
				update: resourceUpdate,
			},
			[Resource.FOLDER]: {
				create: folderCreate,
				delete: folderDelete,
				get: folderGet,
				getAll: folderGetAll,
				update: folderUpdate,
			},
			[Resource.USER]: {
				get: userGet,
				getAll: userGetAll,
			},
			[Resource.GROUP]: {
				get: groupGet,
				getAll: groupGetAll,
			},
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const handler = handlers[resource]?.[operation];
				if (!handler) {
					const msg = handlers[resource]
						? `Unsupported operation: ${operation}`
						: `Unsupported resource: ${resource}`;
					throw new NodeOperationError(this.getNode(), msg, { itemIndex: i });
				}

				const responseData = await handler.call(this, i);
				const outputItems = Array.isArray(responseData) ? responseData : [responseData];
				for (const item of outputItems) {
					returnData.push({ json: item, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

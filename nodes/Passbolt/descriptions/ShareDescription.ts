import type { INodeProperties } from 'n8n-workflow';

import { PermissionType } from '../constants';

export const shareOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['share'],
			},
		},
		options: [
			{
				name: 'Share',
				value: 'shareResource',
				description: 'Share a resource with a user or group.',
				action: 'Share a resource',
			},
		],
		default: 'shareResource',
	},
];

export const shareFields: INodeProperties[] = [
	// ----------------------------------
	//         share: shareResource
	// ----------------------------------
	{
		displayName: 'Resource ID',
		name: 'resourceId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" resources operation.',
		description: 'UUID of the resource to share.',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['shareResource'],
			},
		},
	},
	{
		displayName: 'Share With',
		name: 'shareWith',
		type: 'options',
		noDataExpression: true,
		required: true,
		default: 'user',
		options: [
			{ name: 'User', value: 'user' },
			{ name: 'Group', value: 'group' },
		],
		description: 'Whether to share with a user or a group.',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['shareResource'],
			},
		},
	},
	{
		displayName: 'User ID',
		name: 'shareUserId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" users operation.',
		description: 'UUID of the user to share with.',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['shareResource'],
				shareWith: ['user'],
			},
		},
	},
	{
		displayName: 'Group ID',
		name: 'shareGroupId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" groups operation.',
		description: 'UUID of the group to share with.',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['shareResource'],
				shareWith: ['group'],
			},
		},
	},
	{
		displayName: 'Permission Type',
		name: 'permissionType',
		type: 'options',
		noDataExpression: true,
		required: true,
		default: PermissionType.READ,
		options: [
			{ name: 'Read', value: PermissionType.READ, description: 'View the resource only' },
			{ name: 'Update', value: PermissionType.UPDATE, description: 'View and edit the resource' },
			{
				name: 'Owner',
				value: PermissionType.OWNER,
				description: 'Full control: view, edit, share, and delete',
			},
		],
		description: 'Permission level to grant.',
		displayOptions: {
			show: {
				resource: ['share'],
				operation: ['shareResource'],
			},
		},
	},
];

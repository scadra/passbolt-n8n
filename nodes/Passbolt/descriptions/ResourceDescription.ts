import type { INodeProperties } from 'n8n-workflow';

export const resourceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['resource'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new resource (password).',
				action: 'Create a resource',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a resource.',
				action: 'Delete a resource',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a resource.',
				action: 'Get a resource',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many resources.',
				action: 'Get many resources',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a resource.',
				action: 'Update a resource',
			},
		],
		default: 'getAll',
	},
];

export const resourceFields: INodeProperties[] = [
	// ----------------------------------
	//         resource: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the resource.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Password',
		name: 'password',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: '',
		description: 'Password or secret value.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'A description or note for the resource.',
			},
			{
				displayName: 'Folder ID',
				name: 'folder_parent_id',
				type: 'string',
				default: '',
				description: 'UUID of the parent folder.',
				hint: 'Use the output of a "Get Many" folders operation.',
			},
			{
				displayName: 'URI',
				name: 'uri',
				type: 'string',
				default: '',
				description: 'URI or URL associated with the resource.',
			},
			{
				displayName: 'Username',
				name: 'username',
				type: 'string',
				default: '',
				description: 'Username associated with the resource.',
			},
		],
	},

	// ----------------------------------
	//         resource: delete
	// ----------------------------------
	{
		displayName: 'Resource ID',
		name: 'resourceId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" resources operation.',
		description: 'UUID of the resource to delete.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['delete'],
			},
		},
	},

	// ----------------------------------
	//         resource: get
	// ----------------------------------
	{
		displayName: 'Resource ID',
		name: 'resourceId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" resources operation.',
		description: 'UUID of the resource to retrieve.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['get'],
			},
		},
	},

	// ----------------------------------
	//         resource: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		noDataExpression: true,
		default: false,
		description: 'Whether to return all results or only up to a given limit.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Folder ID',
				name: 'filter[has-parent]',
				type: 'string',
				default: '',
				description:
					'Return only resources located in this folder (UUID). Subfolders are not included.',
			},
			{
				displayName: 'Favorite Only',
				name: 'filter[is-favorite]',
				type: 'options',
				noDataExpression: true,
				default: '',
				description: 'Return only favorited, only non-favorited, or all resources.',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Yes', value: '1' },
					{ name: 'No', value: '0' },
				],
			},
			{
				displayName: 'Shared with Group',
				name: 'filter[is-shared-with-group]',
				type: 'string',
				default: '',
				description: 'Return only resources shared with this group (UUID).',
			},
		],
	},

	// ----------------------------------
	//         resource: update
	// ----------------------------------
	{
		displayName: 'Resource ID',
		name: 'resourceId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" resources operation.',
		description: 'UUID of the resource to update.',
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['resource'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'New description for the resource.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'New name for the resource.',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'New password or secret value.',
			},
			{
				displayName: 'URI',
				name: 'uri',
				type: 'string',
				default: '',
				description: 'New URI or URL.',
			},
			{
				displayName: 'Username',
				name: 'username',
				type: 'string',
				default: '',
				description: 'New username.',
			},
		],
	},
];

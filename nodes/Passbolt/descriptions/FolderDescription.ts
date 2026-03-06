import type { INodeProperties } from 'n8n-workflow';

export const folderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['folder'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new folder.',
				action: 'Create a folder',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a folder.',
				action: 'Delete a folder',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a folder.',
				action: 'Get a folder',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many folders.',
				action: 'Get many folders',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a folder.',
				action: 'Update a folder',
			},
		],
		default: 'getAll',
	},
];

export const folderFields: INodeProperties[] = [
	// ----------------------------------
	//         folder: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the folder.',
		displayOptions: {
			show: {
				resource: ['folder'],
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
				resource: ['folder'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Parent Folder ID',
				name: 'folder_parent_id',
				type: 'string',
				default: '',
				hint: 'Use the output of a "Get Many" folders operation.',
				description: 'UUID of the parent folder (leave empty for root).',
			},
		],
	},

	// ----------------------------------
	//         folder: delete
	// ----------------------------------
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" folders operation.',
		description: 'UUID of the folder to delete.',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['delete'],
			},
		},
	},

	// ----------------------------------
	//         folder: get
	// ----------------------------------
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" folders operation.',
		description: 'UUID of the folder to retrieve.',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['get'],
			},
		},
	},

	// ----------------------------------
	//         folder: getAll
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
				resource: ['folder'],
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
				resource: ['folder'],
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
				resource: ['folder'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Search',
				name: 'filter[search]',
				type: 'string',
				default: '',
				description: 'Filter folders by name (partial match).',
			},
			{
				displayName: 'Has Parent',
				name: 'filter[has-parent]',
				type: 'string',
				default: '',
				description: 'Filter by parent folder UUID.',
			},
		],
	},

	// ----------------------------------
	//         folder: update
	// ----------------------------------
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" folders operation.',
		description: 'UUID of the folder to update.',
		displayOptions: {
			show: {
				resource: ['folder'],
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
				resource: ['folder'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'New name for the folder.',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'folder_parent_id',
				type: 'string',
				default: '',
				description: 'Move folder to a different parent (UUID).',
			},
		],
	},
];

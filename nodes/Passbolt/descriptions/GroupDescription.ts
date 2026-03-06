import type { INodeProperties } from 'n8n-workflow';

export const groupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['group'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a group.',
				action: 'Get a group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many groups.',
				action: 'Get many groups',
			},
		],
		default: 'getAll',
	},
];

export const groupFields: INodeProperties[] = [
	// ----------------------------------
	//         group: get
	// ----------------------------------
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" groups operation.',
		description: 'UUID of the group to retrieve.',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['get'],
			},
		},
	},

	// ----------------------------------
	//         group: getAll
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
				resource: ['group'],
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
				resource: ['group'],
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
				resource: ['group'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Has Users',
				name: 'filter[has-users]',
				type: 'string',
				default: '',
				description: 'Filter groups that contain this user UUID.',
			},
			{
				displayName: 'Has Manager',
				name: 'filter[has-managers]',
				type: 'string',
				default: '',
				description: 'Filter to groups where this user (UUID) is a manager.',
			},
		],
	},
];

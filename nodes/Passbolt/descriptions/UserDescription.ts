import type { INodeProperties } from 'n8n-workflow';

export const userOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['user'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a user.',
				action: 'Get a user',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many users.',
				action: 'Get many users',
			},
		],
		default: 'getAll',
	},
];

export const userFields: INodeProperties[] = [
	// ----------------------------------
	//         user: get
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		hint: 'Use the output of a "Get Many" users operation.',
		description: 'UUID of the user to retrieve.',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['get'],
			},
		},
	},

	// ----------------------------------
	//         user: getAll
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
				resource: ['user'],
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
				resource: ['user'],
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
				resource: ['user'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Search',
				name: 'filter[search]',
				type: 'string',
				default: '',
				description: 'Search users by name or email.',
			},
			{
				displayName: 'Member of Group',
				name: 'filter[has-groups]',
				type: 'string',
				default: '',
				description: 'Filter to users who are members of this group (UUID).',
			},
			{
				displayName: 'Is Admin',
				name: 'filter[is-admin]',
				type: 'options',
				noDataExpression: true,
				default: '',
				description: 'Return only admin users, only non-admin users, or all users.',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Yes', value: '1' },
					{ name: 'No', value: '0' },
				],
			},
		],
	},
];

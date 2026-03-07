import type { INodeProperties } from 'n8n-workflow';

export const utilityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['utility'] } },
		options: [
			{
				name: 'Decrypt',
				value: 'decrypt',
				description: 'Decrypt a PGP-armored message using stored credentials.',
				action: 'Decrypt a PGP message',
			},
		],
		default: 'decrypt',
	},
];

export const utilityFields: INodeProperties[] = [
	{
		displayName: 'Encrypted Data',
		name: 'encryptedData',
		type: 'string',
		typeOptions: { rows: 5 },
		required: true,
		displayOptions: { show: { resource: ['utility'], operation: ['decrypt'] } },
		default: '',
		placeholder: '-----BEGIN PGP MESSAGE-----',
		description:
			'A PGP-armored encrypted message to decrypt using the configured private key.',
	},
];

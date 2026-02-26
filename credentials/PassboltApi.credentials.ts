import type { ICredentialType, ICredentialTestRequest, INodeProperties } from 'n8n-workflow';

/**
 * n8n credential type for the Passbolt password manager API.
 *
 * Stores the four values required for both JWT authentication and end-to-end
 * GPG encryption:
 * - **serverUrl** — base URL of the Passbolt instance.
 * - **userId** — UUID of the authenticating user (shown in the Passbolt profile).
 * - **privateKey** — OpenPGP private key used to sign challenge responses and
 *   decrypt secrets. Export it from the Passbolt profile page (Keys inspector)
 *   or via `gpg --armor --export-secret-keys <email>`.
 * - **passphrase** — passphrase protecting the private key.
 *
 * The `test` property issues a GET to the unauthenticated `/healthcheck/status.json`
 * endpoint. This verifies that `serverUrl` is reachable and returns a valid response,
 * giving immediate feedback if the URL is wrong or the server is down.
 * Full GPG authentication errors (wrong key / passphrase) are still surfaced at
 * execution time via `NodeApiError` from `passboltApiRequest`.
 */
export class PassboltApi implements ICredentialType {
	name = 'passboltApi';
	displayName = 'Passbolt API';
	documentationUrl = 'https://gitlab.com/switch-case/passbolt-n8n';
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serverUrl}}',
			url: '/healthcheck/status.json',
		},
	};
	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: '',
			placeholder: 'https://passbolt.example.com',
			description: 'Base URL of your Passbolt instance (without trailing slash).',
			required: true,
		},
		{
			displayName: 'User ID',
			name: 'userId',
			type: 'string',
			default: '',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
			description: 'Passbolt user UUID (found in your Passbolt profile).',
			required: true,
		},
		{
			displayName: 'Private Key (Armored)',
			name: 'privateKey',
			type: 'string',
			typeOptions: {
				password: true,
				rows: 5,
			},
			default: '',
			placeholder: '-----BEGIN PGP PRIVATE KEY BLOCK-----',
			description:
				'Your OpenPGP private key in armored format. Export it from your Passbolt ' +
				'profile page (Keys inspector → Export secret key), or via ' +
				'`gpg --armor --export-secret-keys <email>`.',
			required: true,
		},
		{
			displayName: 'Passphrase',
			name: 'passphrase',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			hint: 'The passphrase you set when exporting your private key from Passbolt.',
			description:
				'The passphrase used to protect your private key. ' +
				'Note: the credential test only checks that the server URL is reachable. ' +
				'An incorrect passphrase or private key will only be detected when the node executes.',
			required: true,
		},
	];
}

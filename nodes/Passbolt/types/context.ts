import type * as openpgp from 'openpgp';

/**
 * Pre-resolved credentials and decrypted private key for a single execution.
 * All properties are `readonly` to prevent accidental mutation of cryptographic material.
 */
export interface PassboltContext {
	readonly serverUrl: string;
	readonly userId: string;
	readonly privateKey: openpgp.PrivateKey;
}

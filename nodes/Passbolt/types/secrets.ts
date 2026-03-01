/**
 * Encrypted secret entry attached to a resource.
 * @property data - PGP-armored ciphertext.
 * @property user_id - Present when encrypted for a specific user; absent for the owner copy.
 */
export interface PassboltSecret {
	data: string;
	user_id?: string;
	[key: string]: unknown;
}

/**
 * Decrypted plaintext content of a `password-and-description` resource.
 * Serialised as JSON before encryption; other resource types differ.
 */
export interface PassboltSecretClear {
	password: string;
	description?: string;
}

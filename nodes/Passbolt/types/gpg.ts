/**
 * OpenPGP public key as returned by the Passbolt API.
 * @property armored_key - ASCII-armored public key block.
 * @property fingerprint - Optional 40-char hex fingerprint.
 */
export interface PassboltGpgKey {
	armored_key: string;
	fingerprint?: string;
	[key: string]: unknown;
}

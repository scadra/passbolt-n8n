/** Raw credential values as stored in n8n (before key decryption). */
export interface PassboltApiCredentials {
	serverUrl: string;
	userId: string;
	privateKey: string;
	passphrase: string;
}

import type { PassboltSecret, PassboltSecretClear } from './secrets';

/** A Passbolt password resource. `secrets` is populated only with `contain[secret]=1`. */
export interface PassboltResource {
	id: string;
	name?: string;
	username?: string;
	uri?: string;
	description?: string;
	resource_type_id?: string;
	folder_parent_id?: string;
	/** Populated when `contain[secret]=1`. */
	secrets?: PassboltSecret[];
	secret_clear?: PassboltSecretClear | string;
	[key: string]: unknown;
}

/** A resource-type descriptor (slug, name, definition ID). */
export interface PassboltResourceType {
	id: string;
	slug: string;
	name: string;
	description?: string;
	[key: string]: unknown;
}

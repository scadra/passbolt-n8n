import type { PassboltGpgKey } from './gpg';

/** A Passbolt user account. */
export interface PassboltUser {
	id: string;
	/** Populated when `contain[gpgkey]=1`. */
	gpgkey?: PassboltGpgKey;
	[key: string]: unknown;
}

/** A single group-membership entry. */
export interface PassboltGroupUser {
	user_id: string;
	group_id?: string;
	is_admin?: boolean;
	[key: string]: unknown;
}

/** A Passbolt group. `groups_users` is populated only with `contain[group_user]=1`. */
export interface PassboltGroup {
	id: string;
	name?: string;
	/** Populated when `contain[group_user]=1`. */
	groups_users?: PassboltGroupUser[];
	[key: string]: unknown;
}

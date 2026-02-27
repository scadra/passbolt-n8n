import type { JsonObject } from 'n8n-workflow';

/**
 * Passbolt share permission levels.
 * - READ (1): view only
 * - UPDATE (7): view and edit
 * - OWNER (15): full control (share, delete)
 * @see https://help.passbolt.com/api/permissions
 */
export const enum PermissionType {
	READ = 1,
	UPDATE = 7,
	OWNER = 15,
}

/**
 * Canonical Passbolt REST endpoint paths (without base URL).
 * All function entries accept a resource `id` (UUID).
 */
export const PASSBOLT_API = {
	AUTH_VERIFY: '/auth/verify.json',
	AUTH_LOGIN: '/auth/jwt/login.json',
	AUTH_REFRESH: '/auth/jwt/refresh.json',
	RESOURCES: '/resources.json',
	RESOURCE: (id: string) => `/resources/${id}.json`,
	RESOURCE_TYPES: '/resource-types.json',
	FOLDERS: '/folders.json',
	FOLDER: (id: string) => `/folders/${id}.json`,
	USERS: '/users.json',
	USER: (id: string) => `/users/${id}.json`,
	GROUPS: '/groups.json',
	GROUP: (id: string) => `/groups/${id}.json`,
	SHARE_RESOURCE: (id: string) => `/share/resource/${id}.json`,
} as const;

/**
 * Known Passbolt resource-type slugs.
 * Additional slugs can be added as Passbolt supports more types.
 */
export enum ResourceTypeSlug { PASSWORD_AND_DESCRIPTION = 'password-and-description' }

/**
 * Pre-built `contain[…]` query-param objects for common Passbolt API includes.
 * Pass one of these to include related data and avoid extra round-trips.
 */
export const PASSBOLT_CONTAIN = {
	secret: { 'contain[secret]': 1 } as const,
	permissions: { 'contain[permissions]': 1 } as const,
	gpgkey: { 'contain[gpgkey]': 1 } as const,
	groupUser: { 'contain[group_user]': 1 } as const,
} as const;

/**
 * Challenge-response protocol version sent in the JWT login payload.
 * Pinned to Passbolt API v1 spec; increment only on protocol change.
 */
export const CHALLENGE_VERSION = '1.0.0';

/**
 * Sentinel stored in `secret_clear` when decryption fails for a resource.
 * Callers must check for this value; it must never be stored back to Passbolt.
 */
export const DECRYPTION_FAILED_SENTINEL = '[decryption failed]';

/**
 * Standard n8n output returned for successful delete operations.
 * Passbolt returns no body on DELETE; this is synthesised by the node.
 */
export const DELETE_SUCCESS: JsonObject = { deleted: true };

/** Passbolt ARO (Access Request Object) entity type identifiers used in permission payloads. */
export enum PassboltAro { USER = 'User', GROUP = 'Group' }

/** Passbolt ACO (Access Control Object) entity type identifiers. */
export enum PassboltAco { RESOURCE = 'Resource' }

/** HTTP methods used in Passbolt API requests. */
export enum HttpMethod { GET = 'GET', POST = 'POST', PUT = 'PUT', DELETE = 'DELETE' }

/** Node resource types. */
export enum Resource { FOLDER = 'folder', GROUP = 'group', RESOURCE = 'resource', SHARE = 'share', USER = 'user', UTILITY = 'utility' }

/** Share target type. */
export enum ShareTarget { USER = 'user', GROUP = 'group' }

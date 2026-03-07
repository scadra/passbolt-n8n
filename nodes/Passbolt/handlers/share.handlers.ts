import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	passboltApiRequest,
	getCredentialsAndPrivateKey,
	decryptSecretWithCtx,
	encryptSecretForUserWithCtx,
} from '../GenericFunctions';
import type { PassboltContext, PassboltGroup, PassboltResource, PassboltUser } from '../types';
import { PASSBOLT_API, PASSBOLT_CONTAIN, PassboltAro, PassboltAco, HttpMethod, ShareTarget } from '../constants';
import { Param } from './utils';

/**
 * Builds permission and secret entries to share a resource with a single user.
 *
 * @throws `NodeOperationError` if the user has no registered GPG key.
 */
async function buildUserShare(
	this: IExecuteFunctions,
	shareUserId: string,
	permissionType: number,
	resourceId: string,
	decryptedSecret: string,
	ctx: PassboltContext,
	itemIndex: number,
): Promise<{ permissions: Array<Record<string, unknown>>; secrets: Array<Record<string, string>> }> {
	const user = (await passboltApiRequest.call(
		this,
		HttpMethod.GET,
		PASSBOLT_API.USER(shareUserId),
		undefined,
		PASSBOLT_CONTAIN.gpgkey,
		ctx,
	)) as PassboltUser;

	if (!user.gpgkey?.armored_key) {
		throw new NodeOperationError(this.getNode(), 'User has no GPG public key', { itemIndex });
	}

	const encryptedForUser = await encryptSecretForUserWithCtx(
		decryptedSecret,
		user.gpgkey.armored_key,
		ctx,
	);

	return {
		permissions: [
			{
				is_new: true,
				aro: PassboltAro.USER,
				aro_foreign_key: shareUserId,
				aco: PassboltAco.RESOURCE,
				aco_foreign_key: resourceId,
				type: permissionType,
			},
		],
		secrets: [{ user_id: shareUserId, data: encryptedForUser }],
	};
}

/**
 * Builds permission and secret entries to share a resource with all members of a group.
 *
 * Uses `Promise.allSettled` so a failure for one member does not abort the share
 * for the rest of the group. Members without a GPG key are logged as skipped.
 */
async function buildGroupShare(
	this: IExecuteFunctions,
	shareGroupId: string,
	permissionType: number,
	resourceId: string,
	decryptedSecret: string,
	ctx: PassboltContext,
): Promise<{ permissions: Array<Record<string, unknown>>; secrets: Array<Record<string, string>> }> {
	const group = (await passboltApiRequest.call(
		this,
		HttpMethod.GET,
		PASSBOLT_API.GROUP(shareGroupId),
		undefined,
		PASSBOLT_CONTAIN.groupUser,
		ctx,
	)) as PassboltGroup;

	const groupUsers = group.groups_users ?? [];
	const skippedUserIds: string[] = [];

	const memberResults = await Promise.allSettled(
		groupUsers.map(async (groupUser) => {
			const member = (await passboltApiRequest.call(
				this,
				HttpMethod.GET,
				PASSBOLT_API.USER(groupUser.user_id),
				undefined,
				PASSBOLT_CONTAIN.gpgkey,
				ctx,
			)) as PassboltUser;

			if (!member.gpgkey?.armored_key) {
				return { user_id: groupUser.user_id, skipped: true, data: '' };
			}

			const encryptedForMember = await encryptSecretForUserWithCtx(
				decryptedSecret,
				member.gpgkey.armored_key,
				ctx,
			);
			return { user_id: groupUser.user_id, skipped: false, data: encryptedForMember };
		}),
	);

	const secrets: Array<Record<string, string>> = [];
	for (const result of memberResults) {
		if (result.status === 'fulfilled') {
			if (result.value.skipped) {
				skippedUserIds.push(result.value.user_id);
			} else {
				secrets.push({ user_id: result.value.user_id, data: result.value.data });
			}
		} else {
			this.logger.warn(
				`Share: failed to encrypt secret for a group member: ${(result.reason as Error)?.message ?? result.reason}`,
			);
		}
	}

	if (skippedUserIds.length > 0) {
		this.logger.warn(
			`Share: ${skippedUserIds.length} group member(s) skipped (no GPG key): ${skippedUserIds.join(', ')}`,
		);
	}

	return {
		permissions: [
			{
				is_new: true,
				aro: PassboltAro.GROUP,
				aro_foreign_key: shareGroupId,
				aco: PassboltAco.RESOURCE,
				aco_foreign_key: resourceId,
				type: permissionType,
			},
		],
		secrets,
	};
}

/**
 * Shares a Passbolt resource with a user or group.
 *
 * Decrypts the resource secret, then re-encrypts it with each recipient's
 * public key before calling `PUT /share/resource/:id.json`.
 *
 * @throws `NodeOperationError` if the resource has no secret, or if a target
 *         user has no registered GPG key.
 */
export async function shareResource(this: IExecuteFunctions, i: number): Promise<JsonObject> {
	const ctx = await getCredentialsAndPrivateKey(this);
	const resourceId = this.getNodeParameter(Param.RESOURCE_ID, i) as string;
	const shareWith = this.getNodeParameter(Param.SHARE_WITH, i) as string;
	const permissionType = this.getNodeParameter(Param.PERMISSION_TYPE, i) as number;

	const resource = (await passboltApiRequest.call(
		this,
		HttpMethod.GET,
		PASSBOLT_API.RESOURCE(resourceId),
		undefined,
		{ ...PASSBOLT_CONTAIN.secret, ...PASSBOLT_CONTAIN.permissions },
		ctx,
	)) as PassboltResource;

	const firstSecret = resource.secrets?.[0];
	if (!firstSecret) {
		throw new NodeOperationError(this.getNode(), 'Resource has no secret data', { itemIndex: i });
	}
	const decryptedSecret = await decryptSecretWithCtx(firstSecret.data, ctx);

	let permissions: Array<Record<string, unknown>>;
	let secrets: Array<Record<string, string>>;

	if (shareWith === ShareTarget.USER) {
		const shareUserId = this.getNodeParameter(Param.SHARE_USER_ID, i) as string;
		({ permissions, secrets } = await buildUserShare.call(
			this,
			shareUserId,
			permissionType,
			resourceId,
			decryptedSecret,
			ctx,
			i,
		));
	} else {
		const shareGroupId = this.getNodeParameter(Param.SHARE_GROUP_ID, i) as string;
		({ permissions, secrets } = await buildGroupShare.call(
			this,
			shareGroupId,
			permissionType,
			resourceId,
			decryptedSecret,
			ctx,
		));
	}

	return passboltApiRequest.call(
		this,
		HttpMethod.PUT,
		PASSBOLT_API.SHARE_RESOURCE(resourceId),
		{ permissions, secrets },
		undefined,
		ctx,
	);
}

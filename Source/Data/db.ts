import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from "./schema";
import { isValidKey } from "./key";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { join } from "node:path";

export const filePath = join(env.DATA_DIR, "db.sqlite");

export const db = drizzle(`file:${filePath}`, {
	relations: schema.relations,
	schema: schema,
});

export async function doesKeyExist(key: string): Promise<boolean> {
	if (!isValidKey(key)) return false;

	const queriedGroup = await db.query.groupTable.findFirst({
		where: {
			key: key,
		},
	});

	if (!queriedGroup) return false;

	return true;
}

export async function createUserIfNotExists(
	robloxUserId: string,
) {
	return await db.insert(schema.userTable).values({
		robloxUserId: robloxUserId,
	}).onConflictDoNothing();
}

async function getManyUsers(robloxUserIds: string[]): Promise<schema.User[]> {
	const users = new Set<schema.User>();

	for (const userId of robloxUserIds) {
		const queriedUser = await db.query.userTable.findFirst({
			where: {
				robloxUserId: userId,
			},
		});

		if (!queriedUser) {
			console.warn(`user with the roblox id of ${userId} does not exist`);
			continue;
		}

		users.add(queriedUser);
	}

	return [...users];
}

export async function saveNewKey(key: string): Promise<string> {
	return db.transaction(async tx => {
		const [group] = await tx
			.insert(schema.groupTable)
			.values({
				key,
			})
			.returning();

		const groupId = group!.id;

		return groupId;
	});
}

export async function saveKey(
	key: string,
	userIds: string[],
	authorisedAssets: string[],
	isAdmin: boolean,
): Promise<void> {
	for (const userId of userIds) {
		await createUserIfNotExists(userId);
	}

	const users = await getManyUsers(userIds.map((value) => value.toString()));

	await db.transaction(async (tx) => {
		const existingGroup = await tx.query.groupTable.findFirst({
			where: {
				key: key,
			},
		});

		if (!existingGroup) throw new Error("key does not exist, use saveNewKey() first");

		const groupId = existingGroup.id;

		await tx.update(schema.groupTable).set({
			isAdmin: isAdmin,
		}).where(eq(schema.groupTable.id, groupId));

		await tx.delete(schema.userToGroupTable).where(eq(schema.userToGroupTable.groupId, groupId));

		if (users.length > 0) {
			await tx
				.insert(schema.userToGroupTable)
				.values(
					users.map((user) => ({
						userId: user.id,
						groupId,
					})),
				)
				.onConflictDoNothing();
		}

		await tx.delete(schema.assetTable).where(eq(schema.assetTable.groupId, groupId));

		if (authorisedAssets.length > 0) {
			await tx.insert(schema.assetTable).values(
				authorisedAssets.map((assetId) => ({
					robloxId: assetId.toString(),
					groupId,
				})),
			).onConflictDoNothing();
		}
	});
}

export async function deleteKey(key: string): Promise<void> {
	if (!isValidKey(key)) return;

	console.log(key);
	await db.delete(schema.groupTable).where(eq(schema.groupTable.key, key));

	return;
}

export async function getAllGroups(): Promise<schema.Group[]> {
	return await db.query.groupTable.findMany();
}

export async function getAuthorisedAssets(
	key: string,
): Promise<string[] | null> {
	if (!isValidKey(key)) return null;

	const queriedGroup = await db.query.groupTable.findFirst({
		where: {
			key: key,
		},
	});

	if (!queriedGroup) return null;

	const assets = await db.query.assetTable.findMany({
		where: {
			owner: {
				id: queriedGroup.id,
			},
		},
	});

	return assets.map((value) => value.robloxId);
}

export async function getAdmins() {
	const groups = await db.query.groupTable.findMany({
		where: {
			isAdmin: true,
		},
	});

	return groups;
}

export async function getIsAdmin(key: string) {
	return (await getAdmins())?.find(val => val.key === key)?.isAdmin ?? false;
}

export async function getUsers(key: string) {
	if (!isValidKey(key)) return null;

	const group = await db.query.groupTable.findFirst({
		where: {
			key,
		},
	});

	if (!group) return null;

	const users = await db.query.userTable.findMany({
		where: {
			groups: {
				id: group?.id,
			},
		},
	});

	return users;
}

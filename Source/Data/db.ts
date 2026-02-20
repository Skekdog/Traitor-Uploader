import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from "./schema";
import { isValidKey } from "./key";
import { eq } from "drizzle-orm";

export const db = drizzle("file:db.sqlite", {
	relations: schema.relations,
	schema: schema,
});

export async function doesKeyExist(key: string): Promise<boolean> {
	if (!isValidKey(key)) return false;

	const queriedKey = await db.query.keyTable.findFirst({
		where: {
			key: key,
		},
	});

	if (!queriedKey) return false;

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
				name: `Key Group ${key}`,
			})
			.returning();

		const groupId = group!.id;

		await tx.insert(schema.keyTable).values({
			key,
			ownerId: groupId,
			isAdmin: 0,
		});

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
		const existingKey = await tx.query.keyTable.findFirst({
			where: {
				key: key,
			},
		});

		if (!existingKey) throw new Error("key does not exist, use saveNewKey() first");

		const groupId = existingKey.ownerId;

		await tx.update(schema.keyTable).set({
			isAdmin: isAdmin ? 1 : 0,
		}).where(eq(schema.keyTable.key, key));

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

		await tx.delete(schema.assetTable).where(eq(schema.assetTable.key, key));

		if (authorisedAssets.length > 0) {
			await tx.insert(schema.assetTable).values(
				authorisedAssets.map((assetId) => ({
					robloxId: assetId.toString(),
					key,
				})),
			).onConflictDoNothing();
		}
	});
}

export async function deleteKey(key: string): Promise<void> {
	if (!isValidKey(key)) return;

	await db.delete(schema.keyTable).where(eq(schema.keyTable.key, key));

	return;
}

export async function getAllKeys(): Promise<schema.Key[]> {
	return await db.query.keyTable.findMany();
}

export async function getAuthorisedAssets(
	key: string,
): Promise<string[] | null> {
	if (!isValidKey(key)) return null;

	const queriedKey = await db.query.keyTable.findFirst({
		where: {
			key: key,
		},
	});

	if (!queriedKey) return null;

	const assets = await db.query.assetTable.findMany({
		where: {
			owner: {
				key: queriedKey.key,
			},
		},
	});

	return assets.map((value) => value.robloxId);
}

export async function getAdmins() {
	const keys = await db.query.keyTable.findMany({
		where: {
			isAdmin: 1,
		},
	});

	return keys;
}

export async function getIsAdmin(key: string) {
	return Boolean((await getAdmins())?.find(val => val.key === key)?.isAdmin ?? false);
}

export async function getUsers(key: string) {
	if (!isValidKey(key)) return null;

	const users = await db.query.userTable.findMany({
		where: {
			groups: {
				keys: {
					key: key,
				},
			},
		},
	});

	return users;
}

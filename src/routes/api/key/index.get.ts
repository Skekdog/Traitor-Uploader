import {
	getAllGroups,
	getUsers,
	getAuthorisedAssets,
	getIsAdmin,
} from "#/data/db.js";
import { defineHandler } from "nitro";

export default defineHandler(async (event) => {
	const keys = await getAllGroups();
	const keyValues: Record<
		string,
		{ userIds: string; assetIds: string; isAdmin: boolean }
	> = {};

	for (const { key } of keys) {
		const users = ((await getUsers(key)) ?? []).map((u) => u.robloxUserId);
		const assets = (await getAuthorisedAssets(key)) ?? [];
		const isAdmin = await getIsAdmin(key);

		keyValues[key] = {
			userIds: users.join(","),
			assetIds: assets.join(","),
			isAdmin,
		};
	}

	return keyValues;
});

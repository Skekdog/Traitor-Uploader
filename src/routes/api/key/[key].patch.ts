import { KEY_ASSET_LIMIT } from "#/backend.js";
import {
	doesKeyExist,
	getAuthorisedAssets,
	getIsAdmin,
	getUsers,
	saveKey,
} from "#/data/db.js";
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam, readBody } from "nitro/h3";
import * as z from "zod/v4";

const updateKeySchema = z.object({
	userIds: z.array(z.number()).optional(),
	assetIds: z.array(z.number()).optional(),
	isAdmin: z.boolean().optional(),
});

export default defineHandler(async (event) => {
	const key = getRouterParam(event, "key");
	if (!key || !(await doesKeyExist(key))) {
		throw new HTTPError({
			statusCode: 404,
			statusMessage: "Key not found",
		});
	}

	const rawBody = await readBody(event);
	const result = updateKeySchema.safeParse(rawBody);

	if (!result.success) {
		throw new HTTPError({
			statusCode: 400,
			statusMessage: "Invalid request body",
			data: z.treeifyError(result.error),
		});
	}

	const body = result.data;

	const isAdmin =
		body.isAdmin === undefined ? await getIsAdmin(key) : body.isAdmin;

	if ((body.assetIds?.length ?? 0) > KEY_ASSET_LIMIT && !isAdmin) {
		throw new HTTPError({
			statusCode: 400,
			statusMessage: "Asset limit exceeded",
		});
	}

	const queriedUsers = (await getUsers(key)) ?? [];

	await saveKey(
		key,
		body.userIds?.map((v) => v.toString()) ??
			queriedUsers.map((v) => v.robloxUserId),
		body.assetIds?.map((v) => v.toString()) ??
			(await getAuthorisedAssets(key)) ??
			[],
		isAdmin,
	);

	return { success: true };
});

import { bearer as bearerAuth } from "@elysiajs/bearer";
import Elysia, { status, t } from "elysia";
import { env } from "../env";
import {
	deleteKey,
	doesKeyExist,
	getAllKeys,
	getAuthorisedAssets,
	getUsers,
	saveKey,
	saveNewKey,
	getIsAdmin,
} from "../Data/db";
import { generate } from "../Data/key";
import { backend, KEY_ASSET_LIMIT } from "../Server/backend-server";
import index from "./Client/index.html";

const PORT = env.PORT;

export const app = new Elysia()
	.use(backend)
	.get("/", index)
	.use(bearerAuth())
	.get("/key", async ({ bearer }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		const keys = await getAllKeys();

		const keyValues: {[key: string]: {userIds: string, assetIds: string, isAdmin: boolean}} = {};

		for (const { key } of keys) {
			const users = (await getUsers(key) ?? []).map(user => user.robloxUserId);
			const assets = await getAuthorisedAssets(key) ?? [];

			const isAdmin = await getIsAdmin(key);

			keyValues[key] = {
				userIds: users.join(","),
				assetIds: assets.join(","),
				isAdmin: isAdmin,
			};
		}

		return status(200, keyValues);
	})
	.post("/key", async ({ bearer }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		const key = generate();
		await saveNewKey(key);

		return status(200, key);
	})
	.patch(
		"/key/:key",
		async ({ bearer, body, params: { key } }) => {
			if (!bearer) return status(401);
			if (bearer !== env.WEB_PASSWORD) return status(403);

			if (!(await doesKeyExist(key))) return status(404);

			if ((body.assetIds ?? []).length > KEY_ASSET_LIMIT) return status(400);

			const queriedUsers = (await getUsers(key)) ?? [];

			const isAdmin = body.isAdmin === undefined ? await getIsAdmin(key) : body.isAdmin;

			await saveKey(
				key,
				body.userIds?.map((value) => value.toString()) ??
					queriedUsers.map((value) => value.robloxUserId),
				body.assetIds?.map((value) => value.toString()) ??
					(await getAuthorisedAssets(key)) ??
					[],
				isAdmin,
			);

			return status(200);
		},
		{
			body: t.Object({
				userIds: t.Optional(t.Array(t.Number())),
				assetIds: t.Optional(t.Array(t.Number())),
				isAdmin: t.Optional(t.Boolean()),
			}),
		},
	)
	.delete("/key/:key", async ({ bearer, params: { key } }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		if (!(await doesKeyExist(key))) return status(404);

		await deleteKey(key);

		return status(200);
	})
	.listen(PORT);

export type Web = typeof app;

console.log("Ready!");
console.log(`Server starting at ${app.server?.hostname}:${app.server?.port}`);

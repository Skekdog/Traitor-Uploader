import { bearer as bearerAuth } from "@elysiajs/bearer";
import staticPlugin from "@elysiajs/static";
import Elysia, { status, t } from "elysia";
import { env } from "../env";
import { deleteKey, doesKeyExist, getAllKeys, saveKey } from "../Data/db";
import { generate } from "../Data/key";
import { backend, KEY_ASSET_LIMIT } from "../Server/backend-server";

const PORT = env.PORT;

export const app = new Elysia()
	.use(backend)
	.use(
		await staticPlugin({
			assets: "./Source/Web/Client",
			prefix: "/",
		})
	)
	.use(bearerAuth())
	.get("/key", async ({ bearer }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		return status(200, await getAllKeys());
	})
	.post("/key", async ({ bearer }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		const key = generate();
		await saveKey(key, [], []);

		return status(200, key);
	})
	.patch("/key/:key", async ({ bearer, body, params: { key } }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		console.log(key);
		if (!await doesKeyExist(key)) return status(404);

		if ((body.assetIds ?? []).length > KEY_ASSET_LIMIT) return status(400);

		await saveKey(key, body.userIds ?? [], body.assetIds ?? []);

		return status(200);
	}, {
		body: t.Object({
			userIds: t.Optional(t.Array(t.Number())),
			assetIds: t.Optional(t.Array(t.Number())),
		})
	})
	.delete("/key/:key", async ({ bearer, params: { key } }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		if (!await doesKeyExist(key)) return status(404);

		await deleteKey(key);

		console.log("done");

		return status(200);
	})
	.listen(PORT);

export type Web = typeof app;

console.log("Ready!");
console.log(`Server starting at ${app.server?.hostname}:${app.server?.port}`);

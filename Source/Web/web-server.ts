import { bearer as bearerAuth } from "@elysiajs/bearer";
import staticPlugin from "@elysiajs/static";
import Elysia, { status, t } from "elysia";
import { env } from "../env";
import { doesKeyExist, getAllKeys, saveKey } from "../Data/db";
import { generate } from "../Data/key";
import { KEY_ASSET_LIMIT } from "../Server/backend-server";

const PORT = 443;

export const app = new Elysia()
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
	.patch("/key", async ({ bearer, body }) => {
		if (!bearer) return status(401);
		if (bearer !== env.WEB_PASSWORD) return status(403);

		if (!await doesKeyExist(body.key)) return status(404);

		if ((body.assetIds ?? []).length > KEY_ASSET_LIMIT) return status(400);

		await saveKey(body.key, body.userIds ?? [], body.assetIds ?? []);
	}, {
		body: t.Object({
			key: t.String(),
			userIds: t.Optional(t.Array(t.Number())),
			assetIds: t.Optional(t.Array(t.Number())),
		})
	})
	.listen(PORT);

export type Web = typeof app;

console.log(`Web interface starting at ${app.server?.hostname}:${app.server?.port}`);

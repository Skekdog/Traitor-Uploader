import { isUserAuthorisedToAccessAsset } from "#/data/db.js";
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";

export default defineHandler(async (event) => {
	const assetId = getRouterParam(event, "assetId");
	const userId = event.req.headers.get("X-User-Id");

	if (!userId) {
		throw new HTTPError({
			statusCode: 401,
			statusMessage: "provide a X-User-Id header with a roblox user id",
		});
	}

	if (!assetId) {
		throw new HTTPError({
			statusCode: 401,
			statusMessage:
				"i don't know how this is possible, but please make sure to provide an asset id",
		});
	}
	return { canAccess: await isUserAuthorisedToAccessAsset(assetId, userId) };
});

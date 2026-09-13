import { getAssetContent } from "#/backend.js";
import { defineEventHandler, getRouterParam } from "nitro/h3";

export default defineEventHandler(async (event) => {
	const assetId = getRouterParam(event, "assetId")!;

	return await getAssetContent(event, event.context.bearer, assetId);
});

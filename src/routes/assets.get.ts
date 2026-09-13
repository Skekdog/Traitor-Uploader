import { getAvailableAssets } from "#/backend.js";
import { defineEventHandler } from "nitro/h3";

export default defineEventHandler(async (event) => {
	return await getAvailableAssets(event.context.bearer);
});

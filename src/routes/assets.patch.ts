import { updateAsset } from "#/backend.js";
import { defineEventHandler } from "nitro/h3";

export default defineEventHandler(async (event) => {
	const rawBody = await event.req.arrayBuffer();
	const body = rawBody ? new Uint8Array(rawBody) : new Uint8Array(0);

	return await updateAsset(event.context.bearer, body);
});

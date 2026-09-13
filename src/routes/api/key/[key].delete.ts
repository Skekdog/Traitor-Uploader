import { deleteKey, doesKeyExist } from "#/data/db.js";
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";

export default defineHandler(async (event) => {
	const key = getRouterParam(event, "key");
	if (!key || !(await doesKeyExist(key))) {
		throw new HTTPError({
			statusCode: 404,
			statusMessage: "Key not found",
		});
	}

	await deleteKey(key);
	return { success: true };
});

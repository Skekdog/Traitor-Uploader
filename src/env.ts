import { assert } from "#/util/assert.js";
import path from "node:path";

export const env = {
	ROBLOX_API_KEY: assert(
		process.env["ROBLOX_API_KEY"],
		"roblox api key does not exist",
	),
	UPLOADER_ACCOUNT_ID: assert(
		Number.parseInt(
			assert(
				process.env["UPLOADER_ACCOUNT_ID"],
				"uploader account id does not exist",
			),
		),
		"uploader account id does not exist",
	),
	UNIVERSE_ID: assert(
		Number.parseInt(
			assert(process.env["UNIVERSE_ID"], "universe id does not exist"),
		),
		"universe id does not exist",
	),
	WEB_PASSWORD: assert(
		process.env["WEB_PASSWORD"],
		"web password does not exist",
	),
	PORT: assert(
		Number.parseInt(assert(process.env["PORT"], "port does not exist")),
		"port does not exist",
	),
	DATA_DIR: path.resolve(process.env["DATA_DIR"] || "."),
};

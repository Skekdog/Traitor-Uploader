import Bun from "bun";
import assert from "./Util/assert";
import path from "node:path";

export const env = {
	ROBLOX_API_KEY: assert(Bun.env["ROBLOX_API_KEY"], "roblox api key does not exist"),
	UPLOADER_ACCOUNT_ID: assert(Number.parseInt(assert(Bun.env["UPLOADER_ACCOUNT_ID"], "uploader account id does not exist")), "uploader account id does not exist"),
	UNIVERSE_ID: assert(Number.parseInt(assert(Bun.env["UNIVERSE_ID"], "universe id does not exist")), "universe id does not exist"),
	WEB_PASSWORD: assert(Bun.env["WEB_PASSWORD"], "web password does not exist"),
	PORT: assert(Number.parseInt(assert(Bun.env["PORT"], "port does not exist")), "port does not exist"),
	DATA_DIR: path.resolve(Bun.env["DATA_DIR"] || ".")
};

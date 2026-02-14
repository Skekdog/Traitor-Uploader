import Bun from "bun";
import assert from "./Util/assert";

export const env = {
	ROBLOX_API_KEY: assert(Bun.env["ROBLOX_API_KEY"]),
	UPLOADER_ACCOUNT_ID: assert(Number.parseInt(assert(Bun.env["UPLOADER_ACCOUNT_ID"]))),
	UNIVERSE_ID: assert(Number.parseInt(assert(Bun.env["UNIVERSE_ID"]))),
};

import Bun from "bun";

export const env = {
	ROBLOX_API_KEY: Bun.env["ROBLOX_API_KEY"]!,
	UPLOADER_ACCOUNT_ID: Number.parseInt(Bun.env["UPLOADER_ACCOUNT_ID"]!),
};

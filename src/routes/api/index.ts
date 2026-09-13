import { defineHandler } from "nitro";
import { env } from "#/env.js";

export default defineHandler(() => {
	console.log(env.DATA_DIR);
	return { message: "hello from traitor uploader" };
});

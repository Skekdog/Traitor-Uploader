import { saveNewKey } from "#/data/db.js";
import { generate } from "#/data/key.js";
import { defineHandler } from "nitro";

export default defineHandler(async () => {
	const key = generate();
	await saveNewKey(key);
	return key;
});

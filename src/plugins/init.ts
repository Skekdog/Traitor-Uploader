import { definePlugin } from "nitro";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "#/data/db.js";
import { existsSync, mkdirSync } from "node:fs";
import { env } from "#/env.js";

export default definePlugin(async () => {
	if (!existsSync(env.DATA_DIR)) {
		mkdirSync(env.DATA_DIR, { recursive: true });
	}
	await migrate(db, {
		migrationsFolder: "drizzle",
	});
});

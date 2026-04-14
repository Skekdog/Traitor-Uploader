import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./Data/db";
import { existsSync, mkdirSync } from "node:fs";
import { env } from "./env";

if (!existsSync(env.DATA_DIR)) {
    mkdirSync(env.DATA_DIR, { recursive: true });
}

await migrate(db, {
	migrationsFolder: "drizzle"
});

await import("./Web/web-server");
await import("./Server/backend-server");

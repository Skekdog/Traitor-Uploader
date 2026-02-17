import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./Data/db";

migrate(db, {
	migrationsFolder: "drizzle"
});

await import("./Web/web-server");
await import("./Server/backend-server");

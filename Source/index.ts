import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./Data/db";

await migrate(db, {
	migrationsFolder: "drizzle"
});

await import("./Web/web-server");
await import("./Server/backend-server");

import { seed } from "drizzle-seed";
import { db } from "./Source/Data/db";
import { userTable, assetTable, groupTable, keyTable } from "./Source/Data/schema";
import { migrate } from "drizzle-orm/libsql/migrator";

await migrate(db, {
	migrationsFolder: "drizzle"
});

await seed(db, { userTable, assetTable, groupTable, keyTable }, {
	count: 2
});

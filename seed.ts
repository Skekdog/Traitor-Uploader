import { seed } from "drizzle-seed";
import { db } from "#/data/db.js";
import { userTable, assetTable, groupTable } from "#/data/schema.js";
import { migrate } from "drizzle-orm/libsql/migrator";

await migrate(db, {
	migrationsFolder: "drizzle",
});

await seed(
	db,
	{ userTable, assetTable, groupTable },
	{
		count: 2,
	},
);

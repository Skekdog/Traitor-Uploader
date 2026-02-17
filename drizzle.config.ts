import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./Source/Data/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: "db.sqlite",
	},
});

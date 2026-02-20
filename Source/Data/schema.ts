/* eslint @typescript-eslint/no-unsafe-assignment: off, @typescript-eslint/no-unsafe-call: off, @typescript-eslint/no-unsafe-member-access: off */
// eslint is for some reason absolutely scared senseless of drizzle, but its FINE.
import { defineRelations } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { generateId } from "../Util/id";

export const userTable = sqliteTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId()),
	robloxUserId: text("roblox_user_id").notNull().unique(),
});

export const groupTable = sqliteTable("groups", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId()),
	name: text(),
});

export const userToGroupTable = sqliteTable(
	"users_to_groups",
	{
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id),
		groupId: text("group_id")
			.notNull()
			.references(() => groupTable.id),
	},
	(t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

export const keyTable = sqliteTable("keys", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId()),
	key: text("key")
		.unique()
		.notNull()
		.$defaultFn(() => generateId()),
	ownerId: text("owner_id").notNull().references(() => groupTable.id),
	isAdmin: integer("isAdmin", {mode: "boolean"}).notNull().default(false),
});

export const assetTable = sqliteTable("assets", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId()),
	robloxId: text("roblox_id").notNull().unique(),
	key: text("key").notNull().references(() => keyTable.key, {
		onDelete: "cascade"
	}),
});

export const relations = defineRelations(
	{ userTable, keyTable, groupTable, userToGroupTable, assetTable },
	(r) => ({
		userTable: {
			groups: r.many.groupTable({
				from: r.userTable.id.through(r.userToGroupTable.userId),
				to: r.groupTable.id.through(r.userToGroupTable.groupId),
			}),
		},
		groupTable: {
			participants: r.many.userTable(),
			keys: r.many.keyTable()
		},
		keyTable: {
			owner: r.one.groupTable({
				from: r.keyTable.ownerId,
				to: r.groupTable.id,
			}),
			assets: r.many.assetTable()
		},
		assetTable: {
			owner: r.one.keyTable({
				from: r.assetTable.key,
				to: r.keyTable.key
			})
		}
	}),
);

export type Key = typeof keyTable.$inferSelect;
export type User = typeof userTable.$inferSelect;
export type Asset = typeof assetTable.$inferSelect;
export type Group = typeof groupTable.$inferSelect;

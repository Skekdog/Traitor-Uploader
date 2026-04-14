/* eslint @typescript-eslint/no-unsafe-assignment: off, @typescript-eslint/no-unsafe-call: off, @typescript-eslint/no-unsafe-member-access: off */
// eslint is for some reason absolutely scared senseless of drizzle, but its FINE.
import { defineRelations } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { generateId } from "../Util/id";

export const userTable = sqliteTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId())
		.unique(),
	robloxUserId: text("roblox_user_id").notNull().unique(),
});

export const groupTable = sqliteTable("groups", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId())
		.unique(),
	key: text("key")
		.$defaultFn(() => generateId())
		.notNull(),
	isAdmin: integer("isAdmin", {mode: "boolean"}).notNull().default(false),
});

export const userToGroupTable = sqliteTable(
	"users_to_groups",
	{
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id),
		groupId: text("group_id")
			.notNull()
			.references(() => groupTable.id, {
				onDelete: "cascade"
			}),
	},
	(t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

export const assetTable = sqliteTable("assets", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => generateId()),
	robloxId: text("roblox_id").notNull().unique(),
	groupId: text("group_id").notNull().references(() => groupTable.id, {
		onDelete: "cascade"
	}),
});

export const relations = defineRelations(
	{ userTable, groupTable: groupTable, userToGroupTable, assetTable },
	(r) => ({
		userTable: {
			groups: r.many.groupTable({
				from: r.userTable.id.through(r.userToGroupTable.userId),
				to: r.groupTable.id.through(r.userToGroupTable.groupId),
			}),
		},
		groupTable: {
			participants: r.many.userTable(),
		},
		assetTable: {
			owner: r.one.groupTable({
				from: r.assetTable.groupId,
				to: r.groupTable.id,
			})
		}
	}),
);

export type User = typeof userTable.$inferSelect;
export type Asset = typeof assetTable.$inferSelect;
export type Group = typeof groupTable.$inferSelect;

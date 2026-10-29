import { db, getUsers } from "#/data/db.js";
import {
	assetTable,
	groupTable,
	userTable,
	userToGroupTable,
} from "#/data/schema.js";
import { and, eq, inArray } from "drizzle-orm";
import { defineHandler } from "nitro";
import { getRouterParam, HTTPError, readBody } from "nitro/h3";
import * as z from "zod/v4";

const updateVisibilitySchema = z.object({
	public: z.boolean(),
});

export default defineHandler(async (event) => {
	const bearer = event.context.bearer;

	if (!bearer) {
		throw new HTTPError("Unauthorised", { status: 401 });
	}

	const users = await getUsers(bearer);
	if (!users || users.length === 0) {
		throw new HTTPError("Forbidden", { status: 403 });
	}

	const assetId = getRouterParam(event, "assetId");

	if (!assetId) {
		throw new HTTPError({
			statusCode: 400,
			statusMessage: "asset id is required",
		});
	}

	const rawBody = await readBody(event);
	const body = updateVisibilitySchema.safeParse(rawBody);

	if (!body.success) {
		throw new HTTPError({
			statusCode: 400,
			statusMessage: "invalid request body. 'public' must be a boolean.",
			data: body.error.issues,
		});
	}

	const robloxUserIds = users.map((user) => user.robloxUserId);

	const [authorisedAsset] = await db
		.select({
			assetId: assetTable.id,
		})
		.from(assetTable)
		.innerJoin(groupTable, eq(assetTable.groupId, groupTable.id))
		.innerJoin(
			userToGroupTable,
			eq(groupTable.id, userToGroupTable.groupId),
		)
		.innerJoin(userTable, eq(userToGroupTable.userId, userTable.id))
		.where(
			and(
				eq(assetTable.robloxId, assetId),
				inArray(userTable.robloxUserId, robloxUserIds),
			),
		)
		.limit(1);

	if (!authorisedAsset) {
		throw new HTTPError({
			statusCode: 403,
			statusMessage:
				"forbidden: you are not authorised to modify this asset or it does not exist.",
		});
	}

	const [updatedAsset] = await db
		.update(assetTable)
		.set({ public: body.data.public })
		.where(eq(assetTable.robloxId, assetId))
		.returning();

	if (!updatedAsset) {
		throw new HTTPError({
			statusCode: 404,
			statusMessage: "asset not found",
		});
	}

	return {
		success: true,
		asset: updatedAsset,
	};
});

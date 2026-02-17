import { bearer as bearerAuth } from "@elysiajs/bearer";
import Elysia, { status, t } from "elysia";
import { env } from "../env";
import * as net from "./net";
import * as db from "../Data/db";

export const KEY_ASSET_LIMIT = 5;

// Some general notes:
// Private assets can still be viewed by anyone - meaning the description is not a secure place to store data
// Initially I *kinda* wanted to store the key there and authorise updates by checking that key, but that had
// bad vibes and sure enough its not secure. Also, the rate-limit for fetching asset descriptions is very tight.

const MAX_REQUEST_SIZE = 1024 * 1024 * 4; // 4MB. If anyone has a map larger than 4mb I will be very annoyed with them

const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_INTERVAL = 60_000; // in ms

const rateLimits: {[key: string]: {requests: number, firstRequestAt: number} | undefined} = {};

function rateLimit(key: string): boolean {
	const limit = rateLimits[key];
	if (!limit || (performance.now() - limit.firstRequestAt > RATE_LIMIT_INTERVAL)) {
		rateLimits[key] = {requests: 1, firstRequestAt: performance.now()};
		return true;
	}

	if (limit.requests >= RATE_LIMIT_COUNT) return false;

	limit.requests += 1;

	return true;
}

// These are incomplete because I don't care about the other fields

type AssetCreateRequest = {
	assetType: "Model",
	displayName: string,
	description: string,
	creationContext: {
		creator: {
			userId: number,
		},
	},
};

type AssetUpdateRequest = {
	assetId: number,
	description: string,
};

type AssetResponse = {
	assetId: number,
};

type InventoryResponse = {
	inventoryItems: [
		{
			"assetDetails": {
				"assetId": string,
			},
		}
	]
};

type AssetAuthoriseResponse = {
	successAssetIds: number[],
	errors: [
		{
			assetId: number,
			code: string,
		}
	]
};

type AssetLocationResponse = {
	location: string,
};

const availableAssets: number[] = [];

{
	const response = await net.makeRequest<InventoryResponse>(`https://apis.roblox.com/cloud/v2/users/${env.UPLOADER_ACCOUNT_ID}/inventory-items?maxPageSize=100&filter=inventoryItemAssetTypes=MODEL,PACKAGE`, "GET");
	if (!response.Ok) throw new Error("Failed to fetch inventory :sob: " + response.Result);
	response.Result.inventoryItems.forEach(asset => {
		availableAssets.push(Number.parseInt(asset.assetDetails.assetId));
	});
}

async function authoriseGroup(assetId: number) {
	const response = await net.makeRequest<AssetAuthoriseResponse>("https://apis.roblox.com/asset-permissions-api/v1/assets/permissions", "PATCH", JSON.stringify({
		subjectType: "Universe",
		subjectId: env.UNIVERSE_ID.toString(),
		action: "Use",
		requests: [
			{
				grantToDependencies: true,
				assetId: assetId,
			}
		],
		enableDeepAccessCheck: false,
	}), "application/json");

	if (!response.Ok) return response;
	if (response.Result.errors.length > 0) {
		const errorResponse: net.RequestResponse<null> = {Status: 500, Ok: false, Result: net.parseError(response.Result), Raw: response.Raw};
		return errorResponse;
	}

	return response;
}

async function getAvailableAssets(bearer: string | undefined) {
	if (!bearer) return status(401);

	const assets = await db.getAuthorisedAssets(bearer);
	if (assets === null) return status(403);

	return JSON.stringify(assets);
}

async function isAssetAuthorised(bearer: string, assetId: string) {
	return (await db.getAuthorisedAssets(bearer) ?? []).find(value => value === assetId) !== undefined;
}

async function getAssetContent(bearer: string | undefined, assetId: string) {
	// The first 8 bytes are the asset id

	if (!bearer) return status(401);

	if (!await isAssetAuthorised(bearer, assetId)) return status(403);

	if (!rateLimit(bearer)) return status(429);

	const locationRequestHeaders = new Headers();
	locationRequestHeaders.append("AssetType", "Model");

	const response = await net.makeRequest<AssetLocationResponse>(`https://apis.roblox.com/asset-delivery-api/v1/assetId/${assetId}`, "GET", undefined, undefined, locationRequestHeaders);
	if (!response.Ok) return status(500, `Error fetching asset content (${response.Status}): ` + response.Result);

	const contentRequestHeaders = new Headers();
	contentRequestHeaders.append("Accept-Encoding", "gzip");

	const contentResponse = await net.makeRequest<Blob>(response.Result.location, "GET", undefined, undefined, contentRequestHeaders, true);
	if (!contentResponse.Ok) return status(500, `Error fetching asset content (${contentResponse.Status}): ` + contentResponse.Result);

	let data = await contentResponse.Result.arrayBuffer();

	const encoding = contentResponse.Raw.headers.get("Content-Encoding");
	if (encoding) {
		encoding.split(", ").forEach(enc => {
			if (enc === "deflate") {
				data = Bun.inflateSync(data).buffer;
			} else if (enc === "gzip") {
				data = Bun.gunzipSync(data).buffer;
			}
		});
	}

	return data;
}

async function updateAsset(bearer: string | undefined, body: Uint8Array) {
	// The first 8 bytes are used as the asset id

	if (!bearer) return status(401);

	const users = await db.getUsers(bearer);
	if (!users) return status(403);

	if (!rateLimit(bearer)) return status(429);

	const description = users.map((value) => value.robloxUserId).join(",");

	const assetId = new DataView(body.slice(0, 8).buffer, 0, 8).getFloat64(0, true);
	const assetContent = body.slice(8);

	if (!await isAssetAuthorised(bearer, assetId.toString())) return status(403);

	const formData = net.createFileForm(assetContent, "asset.rbxm", "model/x-rbxm");

	const request: AssetUpdateRequest = {
		assetId: assetId,
		description: description,
	};

	const authoriseResponse = await authoriseGroup(assetId);
	if (!authoriseResponse.Ok) return status(500, `Error authorising asset (${authoriseResponse.Status}): ` + authoriseResponse.Result);

	formData.append("request", JSON.stringify(request));

	const operation = await net.makeRequest<net.Operation<AssetResponse>>(`https://apis.roblox.com/assets/v1/assets/${assetId}?updateMask=description`, "PATCH", formData);
	if (!operation.Ok) return status(500, `Error starting upload (${operation.Status}): ` + operation.Result);

	const response = await net.poll("https://apis.roblox.com/assets/v1/", operation.Result);
	if (!response.Ok) return status(500, `Error uploading asset (${response.Status}): ` + response.Result);

	return status(200);
}

async function createAsset(bearer: string | undefined, body: Uint8Array) {
	if (!bearer) return status(401);

	const authorisedAssets = await db.getAuthorisedAssets(bearer);
	if ((authorisedAssets?.length ?? 0) >= KEY_ASSET_LIMIT) return status(499, "Limit Exceeded");

	const formData = net.createFileForm(body, "asset.rbxm", "model/x-rbxm");

	const users = await db.getUsers(bearer);
	if (!users) return status(403);

	if (!rateLimit(bearer)) return status(429);

	const description = users.map((value) => value.robloxUserId).join(",");

	const request: AssetCreateRequest = {
		assetType: "Model",
		displayName: "User Upload " + availableAssets.length,
		description: description,
		creationContext: {
			creator: {
				userId: env.UPLOADER_ACCOUNT_ID,
			},
		},
	};

	formData.append("request", JSON.stringify(request));

	const operation = await net.makeRequest<net.Operation<AssetResponse>>("https://apis.roblox.com/assets/v1/assets", "POST", formData);
	if (!operation.Ok) return status(500, `Error starting upload (${operation.Status}): ` + operation.Result);

	const response = await net.poll("https://apis.roblox.com/assets/v1/", operation.Result);
	if (!response.Ok) return status(500, `Error uploading asset (${response.Status}): ` + response.Result);

	const authoriseResponse = await authoriseGroup(response.Result.assetId);
	if (!authoriseResponse.Ok) return status(500, `Error authorising asset (${authoriseResponse.Status}): ` + authoriseResponse.Result);

	availableAssets.push(response.Result.assetId);

	const newAssets = await db.getAuthorisedAssets(bearer) ?? [];
	newAssets.push(response.Result.assetId.toString());

	const queriedUsers = await db.getUsers(bearer) ?? [];
	await db.saveKey(bearer, queriedUsers.map((value) => value.robloxUserId), newAssets);

	return JSON.stringify(response.Result.assetId);
}

export const backend = new Elysia({
	name: "backend",
	serve: {
		maxRequestBodySize: MAX_REQUEST_SIZE
	}
})
	.use(bearerAuth())
	.get("/assets", ({ bearer }) => {
		return getAvailableAssets(bearer);
	})
	.get("/asset-content/:assetId", ({ bearer, params: { assetId } }) => {
		return getAssetContent(bearer, assetId);
	})
	.patch("/assets", async ({ bearer, body }) => {
		return updateAsset(bearer, body);
	}, {
		body: t.Uint8Array(),
	})
	.post("/assets", async ({ bearer, body }) => {
		return createAsset(bearer, body);
	}, {
		body: t.Uint8Array(),
	});

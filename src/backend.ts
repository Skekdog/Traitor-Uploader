import { env } from "#/env.js";
import * as net from "#/util/net.js";
import * as db from "#/data/db.js";
import { HTTPError, type H3Event } from "nitro";
import { getRequestIP } from "nitro/h3";
import { inflateSync, gunzipSync } from "node:zlib";

export const KEY_ASSET_LIMIT = 5;

// Some general notes:
// Private assets can still be viewed by anyone - meaning the description is not a secure place to store data
// Initially I *kinda* wanted to store the key there and authorise updates by checking that key, but that had
// bad vibes and sure enough its not secure. Also, the rate-limit for fetching asset descriptions is very tight.

export const MAX_REQUEST_SIZE = 1024 * 1024 * 4; // 4MB. If anyone has a map larger than 4mb I will be very annoyed with them

const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_INTERVAL = 60_000; // in ms

const rateLimits: {
	[keyOrAddress: string]:
		{ requests: number; firstRequestAt: number } | undefined;
} = {};

function rateLimit(key: string): boolean {
	const limit = rateLimits[key];
	if (
		!limit ||
		performance.now() - limit.firstRequestAt > RATE_LIMIT_INTERVAL
	) {
		rateLimits[key] = { requests: 1, firstRequestAt: performance.now() };
		return true;
	}

	if (limit.requests >= RATE_LIMIT_COUNT) return false;

	limit.requests += 1;

	return true;
}

// These are incomplete because I don't care about the other fields

type AssetCreateRequest = {
	assetType: "Model";
	displayName: string;
	description: string;
	creationContext: {
		creator: {
			userId: number;
		};
	};
};

type AssetUpdateRequest = {
	assetId: number;
	description: string;
};

type AssetResponse = {
	assetId: number;
};

type InventoryResponse = {
	inventoryItems: [
		{
			assetDetails: {
				assetId: string;
			};
		},
	];
};

type AssetAuthoriseResponse = {
	successAssetIds: number[];
	errors: [
		{
			assetId: number;
			code: string;
		},
	];
};

type AssetLocationResponse = {
	location: string;
};

const availableAssets: number[] = [];

{
	const response = await net.makeRequest<InventoryResponse>(
		`https://apis.roblox.com/cloud/v2/users/${env.UPLOADER_ACCOUNT_ID}/inventory-items?maxPageSize=100&filter=inventoryItemAssetTypes=MODEL,PACKAGE`,
		"GET",
	);
	if (!response.Ok)
		throw new Error("Failed to fetch inventory :sob: " + response.Result);
	response.Result.inventoryItems.forEach((asset) => {
		availableAssets.push(Number.parseInt(asset.assetDetails.assetId));
	});
}

export async function authoriseGroup(assetId: number) {
	const response = await net.makeRequest<AssetAuthoriseResponse>(
		"https://apis.roblox.com/asset-permissions-api/v1/assets/permissions",
		"PATCH",
		JSON.stringify({
			subjectType: "Universe",
			subjectId: env.UNIVERSE_ID.toString(),
			action: "Use",
			requests: [
				{
					grantToDependencies: true,
					assetId: assetId,
				},
			],
			enableDeepAccessCheck: false,
		}),
		"application/json",
	);

	if (!response.Ok) return response;
	if (response.Result.errors.length > 0) {
		const errorResponse: net.RequestResponse<null> = {
			Status: 500,
			Ok: false,
			Result: net.parseError(response.Result),
			Raw: response.Raw,
		};
		return errorResponse;
	}

	return response;
}

export async function getPublicAssets() {
	let publicAssets: string[] = [];

	const admins = await db.getAdmins();
	for (const admin of admins) {
		publicAssets = publicAssets.concat(
			(await db.getAuthorisedAssets(admin.key)) ?? [],
		);
	}

	return publicAssets;
}

export async function getAvailableAssets(bearer: string | undefined) {
	if (!bearer)
		return JSON.stringify({
			private: [],
			public: await getPublicAssets(),
		});

	const assets = await db.getAuthorisedAssets(bearer);
	if (assets === null)
		throw new HTTPError("unauthorised", {
			status: 403,
		});

	return JSON.stringify({
		private: assets,
		public: await getPublicAssets(),
	});
}

export async function isAssetAuthorisedWrite(bearer: string, assetId: string) {
	return ((await db.getAuthorisedAssets(bearer)) ?? []).includes(assetId);
}

export async function isAssetAuthorisedRead(
	bearer: string | undefined,
	assetId: string,
) {
	if (!bearer) return (await getPublicAssets()).includes(assetId);
	return (
		(await isAssetAuthorisedWrite(bearer, assetId)) ??
		(await getPublicAssets()).includes(assetId)
	);
}

export async function getAssetContent(
	event: H3Event,
	bearer: string | undefined,
	assetId: string,
) {
	const clientIP = getRequestIP(event, { xForwardedFor: true });
	// The first 8 bytes are the asset id

	if (!(await isAssetAuthorisedRead(bearer, assetId))) {
		const status = !bearer ? 401 : 403;
		const message = !bearer ? "Unauthorized" : "Forbidden";
		throw new HTTPError(message, { status });
	}

	if (!bearer && !rateLimit(clientIP ?? "")) {
		throw new HTTPError("Too Many Requests", { status: 429 });
	}

	const isAdmin = bearer ? await db.getIsAdmin(bearer) : false;
	if (!isAdmin && bearer && !rateLimit(bearer)) {
		throw new HTTPError("Too Many Requests", { status: 429 });
	}

	const locationRequestHeaders = new Headers();
	locationRequestHeaders.append("AssetType", "Model");

	const response = await net.makeRequest<AssetLocationResponse>(
		`https://apis.roblox.com/asset-delivery-api/v1/assetId/${assetId}`,
		"GET",
		undefined,
		undefined,
		locationRequestHeaders,
	);
	if (!response.Ok) {
		throw new HTTPError(
			`Error fetching asset content (${response.Status}): ${response.Result}`,
			{ status: 500 },
		);
	}

	const contentRequestHeaders = new Headers();
	contentRequestHeaders.append("Accept-Encoding", "gzip");

	const contentResponse = await net.makeRequest<Blob>(
		response.Result.location,
		"GET",
		undefined,
		undefined,
		contentRequestHeaders,
		true,
	);
	if (!contentResponse.Ok) {
		throw new HTTPError(
			`Error fetching asset content (${contentResponse.Status}): ${contentResponse.Result}`,
			{ status: 500 },
		);
	}

	let data = Buffer.from(await contentResponse.Result.arrayBuffer());

	const encoding = contentResponse.Raw.headers.get("Content-Encoding");
	if (encoding) {
		encoding.split(/,\s*/).forEach((enc) => {
			if (enc === "deflate") {
				data = inflateSync(data);
			} else if (enc === "gzip") {
				data = gunzipSync(data);
			}
		});
	}

	return data.buffer.slice(
		data.byteOffset,
		data.byteOffset + data.byteLength,
	) as ArrayBuffer;
}

export async function updateAsset(
	bearer: string | undefined,
	body: Uint8Array,
) {
	// The first 8 bytes are used as the asset id

	if (!bearer) {
		throw new HTTPError("Unauthorized", { status: 401 });
	}

	const users = await db.getUsers(bearer);
	if (!users) {
		throw new HTTPError("Forbidden", { status: 403 });
	}

	const isAdmin = await db.getIsAdmin(bearer);

	if (!isAdmin && !rateLimit(bearer)) {
		throw new HTTPError("Too Many Requests", { status: 429 });
	}

	const description = users.map((value) => value.robloxUserId).join(",");

	const assetId = new DataView(body.buffer, body.byteOffset, 8).getFloat64(
		0,
		true,
	);

	const assetContent = body.slice(8);

	if (!(await isAssetAuthorisedWrite(bearer, assetId.toString()))) {
		throw new HTTPError("Forbidden", { status: 403 });
	}

	const formData = net.createFileForm(
		assetContent,
		"asset.rbxm",
		"model/x-rbxm",
	);

	const request: AssetUpdateRequest = {
		assetId: assetId,
		description: description,
	};

	const authoriseResponse = await authoriseGroup(assetId);
	if (!authoriseResponse.Ok) {
		throw new HTTPError(
			`Error authorising asset (${authoriseResponse.Status}): ${authoriseResponse.Result}`,
			{ status: 500 },
		);
	}

	formData.append("request", JSON.stringify(request));

	const operation = await net.makeRequest<net.Operation<AssetResponse>>(
		`https://apis.roblox.com/assets/v1/assets/${assetId}?updateMask=description`,
		"PATCH",
		formData,
	);
	if (!operation.Ok) {
		throw new HTTPError(
			`Error starting upload (${operation.Status}): ${operation.Result}`,
			{ status: 500 },
		);
	}

	const response = await net.poll(
		"https://apis.roblox.com/assets/v1/",
		operation.Result,
	);
	if (!response.Ok) {
		throw new HTTPError(
			`Error uploading asset (${response.Status}): ${response.Result}`,
			{ status: 500 },
		);
	}

	return { success: true };
}

export async function createAsset(
	bearer: string | undefined,
	body: Uint8Array,
) {
	if (!bearer) {
		throw new HTTPError("Unauthorized", { status: 401 });
	}

	const authorisedAssets = await db.getAuthorisedAssets(bearer);
	const isAdmin = await db.getIsAdmin(bearer);

	if ((authorisedAssets?.length ?? 0) >= KEY_ASSET_LIMIT && !isAdmin) {
		throw new HTTPError("Limit Exceeded", { status: 499 });
	}

	const users = await db.getUsers(bearer);
	if (!users) {
		throw new HTTPError("Forbidden", { status: 403 });
	}

	if (!isAdmin && !rateLimit(bearer)) {
		throw new HTTPError("Too Many Requests", { status: 429 });
	}

	const formData = net.createFileForm(body, "asset.rbxm", "model/x-rbxm");
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

	const operation = await net.makeRequest<net.Operation<AssetResponse>>(
		"https://apis.roblox.com/assets/v1/assets",
		"POST",
		formData,
	);
	if (!operation.Ok) {
		throw new HTTPError(
			`Error starting upload (${operation.Status}): ${operation.Result}`,
			{ status: 500 },
		);
	}

	const response = await net.poll(
		"https://apis.roblox.com/assets/v1/",
		operation.Result,
	);
	if (!response.Ok) {
		throw new HTTPError(
			`Error uploading asset (${response.Status}): ${response.Result}`,
			{ status: 500 },
		);
	}

	const authoriseResponse = await authoriseGroup(response.Result.assetId);
	if (!authoriseResponse.Ok) {
		throw new HTTPError(
			`Error authorising asset (${authoriseResponse.Status}): ${authoriseResponse.Result}`,
			{ status: 500 },
		);
	}

	availableAssets.push(response.Result.assetId);

	const newAssets = (await db.getAuthorisedAssets(bearer)) ?? [];
	newAssets.push(response.Result.assetId.toString());

	const queriedUsers = (await db.getUsers(bearer)) ?? [];
	await db.saveKey(
		bearer,
		queriedUsers.map((value) => value.robloxUserId),
		newAssets,
		await db.getIsAdmin(bearer),
	);

	return JSON.stringify(response.Result.assetId);
}

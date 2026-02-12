import { bearer as bearerAuth } from "@elysiajs/bearer";
import Elysia, { status, t } from "elysia";
import { env } from "./env";
import * as net from "./net";

const PORT = 31352;

const MAX_REQUEST_SIZE = 1024 * 1024 * 4; // 4MB. If anyone has a map larger than 4mb I will be very annoyed with them

const test = "abc";

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
		const errorResponse: net.RequestResponse<null> = {Status: 500, Ok: false, Result: net.parseError(response.Result)};
		return errorResponse;
	}

	return response;
}

function getAvailableAssets(bearer: string | undefined) {
	if (!bearer) return status(401, "Unauthorized");
	if (bearer !== test) return status(403, "Forbidden");

	return JSON.stringify(availableAssets);
}

async function updateAsset(bearer: string | undefined, body: Uint8Array) {
	// The first 8 bytes are used as the asset id

	if (!bearer) return status(401, "Unauthorized");
	if (bearer !== test) return status(403, "Forbidden");

	const assetId = new DataView(body.slice(0, 8).buffer, 0, 8).getFloat64(0, true);
	const assetContent = body.slice(8);

	const formData = net.createFileForm(assetContent, "asset.rbxm", "model/x-rbxm");

	const request: AssetUpdateRequest = {
		assetId: assetId
	};

	const authoriseResponse = await authoriseGroup(assetId);
	if (!authoriseResponse.Ok) return status(500, `Error authorising asset (${authoriseResponse.Status}): ` + authoriseResponse.Result);

	formData.append("request", JSON.stringify(request));

	const operation = await net.makeRequest<net.Operation<AssetResponse>>(`https://apis.roblox.com/assets/v1/assets/${assetId}`, "PATCH", formData);
	if (!operation.Ok) return status(500, `Error starting upload (${operation.Status}): ` + operation.Result);

	const response = await net.poll("https://apis.roblox.com/assets/v1/", operation.Result);
	if (!response.Ok) return status(500, `Error uploading asset (${response.Status}): ` + response.Result);

	return status(200);
}

async function createAsset(bearer: string | undefined, body: Uint8Array) {
	if (!bearer) return status(401, "Unauthorized");
	if (bearer !== test) return status(403, "Forbidden");

	const formData = net.createFileForm(body, "asset.rbxm", "model/x-rbxm");

	const request: AssetCreateRequest = {
		assetType: "Model",
		displayName: "User Upload " + availableAssets.length,
		description: "Test description",
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

	return status(200);
}

const app = new Elysia({
	serve: {
		maxRequestBodySize: MAX_REQUEST_SIZE
	}
})
	.use(bearerAuth())
	.get("/assets", ({ bearer }) => {
		return getAvailableAssets(bearer);
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
	})
	.listen(PORT);

console.log(`Server starting at ${app.server?.hostname}:${app.server?.port}`);

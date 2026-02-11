import { bearer as bearerAuth } from "@elysiajs/bearer";
import Elysia, { form, status, t, type HTTPMethod } from "elysia";
import { env } from "./env";
import type { BodyInit } from "bun";

const PORT = 31352;

const MAX_REQUEST_SIZE = 1024 * 1024 * 4; // 4MB. If anyone has a map larger than 4mb I will be very annoyed with them

const test = "abc"

type Operation<Response> = {
	path: string,
	operationId: string,
} & ({
	done: false,
	response: null,
} | {
	done: true,
	response: Response,
})

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
}

type AssetUpdateRequest = {
	assetId: number,
}

type AssetResponse = {
	assetId: number,
}

type InventoryResponse = {
	inventoryItems: [
		{
			"assetDetails": {
				"assetId": string,
			},
		}
	]
}

type ErrorResponse = {
	errors: [
		{
			code: number,
			message: string,
		}
	]
}

type RequestResponse<T> = {
	Status: number,
} & ({
	Ok: true,
	Result: T,
} | {
	Ok: false,
	Result: string,
});

async function makeRequest<T>(url: string, method?: HTTPMethod, body?: BodyInit, contentType?: string): Promise<RequestResponse<T>> {
	if (url.endsWith("/")) throw new Error("Must not have trailing slash...");

	const headers = new Headers()
	headers.append("x-api-key", env.ROBLOX_API_KEY);

	if (contentType) headers.append("content-type", contentType);

	const response = await fetch(url, {
		method: method,
		body: body,
		headers: headers,
	});

	const text = await response.text();

	if (!response.ok) return new Promise(async (resolve) => {
		resolve({Ok: false, Result: text ?? response.statusText, Status: response.status})
	});

	return new Promise(async (resolve) => {
		resolve({Ok: true, Result: JSON.parse(text) as T, Status: response.status})
	});
}

async function poll<T>(basePath: string, operation: Operation<T>): Promise<RequestResponse<T>> {
	if (!basePath.endsWith("/")) throw new Error("moron");

	const response = await makeRequest<Operation<T>>(basePath + operation.path)
	if (!response.Ok) {
		return new Promise(async (resolve) => {
			resolve(response);
		});
	}

	const result = response.Result
	if (!result.done) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(poll(basePath, operation));
			}, 1000);
		});
	}

	return new Promise(async (resolve) => {
		resolve({Ok: true, Status: response.Status, Result: response.Result.response!});
	});
}

function createFileForm(data: Uint8Array, fileName: string, mimeType: string): FormData {
	const formData = new FormData();
	const file = new File([data], fileName, { type: mimeType });
	formData.append("fileContent", file);
	return formData
}

const availableAssets: number[] = [];

{
	const response = await makeRequest<InventoryResponse>(`https://apis.roblox.com/cloud/v2/users/${env.UPLOADER_ACCOUNT_ID}/inventory-items?maxPageSize=100&filter=inventoryItemAssetTypes=MODEL,PACKAGE`, "GET");
	if (!response.Ok) throw new Error("Failed to fetch inventory :sob: " + response.Result);
	response.Result.inventoryItems.forEach(asset => {
		availableAssets.push(Number.parseInt(asset.assetDetails.assetId));
	});
}

async function authoriseGroup(assetId: number) {
	const response = await makeRequest(`https://apis.roblox.com/asset-permissions-api/v1/assets/permissions`, "PATCH", JSON.stringify({
		subjectType: "Universe",
		subjectId: env.EXPERIENCE_ID.toString(),
		action: "Use",
		requests: [
			{
				grantToDependencies: true,
				assetId: assetId,
			}
		],
		enableDeepAccessCheck: false,
	}), "application/json");

	if (!response.Ok) console.log(response);

	return response;
}

async function updateAsset(bearer: string | undefined, body: Uint8Array) {
	// The first 8 bytes are used as the asset id

	if (!bearer) return status(401, "Unauthorized");
	if (bearer !== test) return status(403, "Forbidden");

	const assetId = new DataView(body.slice(0, 8).buffer, 0, 8).getFloat64(0, true);
	const assetContent = body.slice(8);

	const formData = createFileForm(assetContent, "asset.rbxm", "model/x-rbxm");

	const request: AssetUpdateRequest = {
		assetId: assetId
	}

	const authoriseResponse = await authoriseGroup(assetId);
	if (!authoriseResponse.Ok) return status(500, `Error authorising asset (${authoriseResponse.Status}): ` + authoriseResponse.Result);

	formData.append("request", JSON.stringify(request));

	const operation = await makeRequest<Operation<AssetResponse>>(`https://apis.roblox.com/assets/v1/assets/${assetId}`, "PATCH", formData);
	if (!operation.Ok) return status(500, `Error starting upload (${operation.Status}): ` + operation.Result);

	const response = await poll("https://apis.roblox.com/assets/v1/", operation.Result);
	if (!response.Ok) return status(500, `Error uploading asset (${response.Status}): ` + response.Result);

	return status(200);
}

async function createAsset(bearer: string | undefined, body: Uint8Array) {
	if (!bearer) return status(401, "Unauthorized");
	if (bearer !== test) return status(403, "Forbidden");

	const formData = createFileForm(body, "asset.rbxm", "model/x-rbxm");

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

	const operation = await makeRequest<Operation<AssetResponse>>("https://apis.roblox.com/assets/v1/assets", "POST", formData);
	if (!operation.Ok) return status(500, `Error starting upload (${operation.Status}): ` + operation.Result);

	const response = await poll("https://apis.roblox.com/assets/v1/", operation.Result);
	if (!response.Ok) return status(500, `Error uploading asset (${response.Status}): ` + response.Result);

	return status(200);
}

const app = new Elysia({
		serve: {
			maxRequestBodySize: MAX_REQUEST_SIZE
		}
	})
	.use(bearerAuth())
	.patch("/publish-map", async ({bearer, body}) => {
		return updateAsset(bearer, body);
	}, {
		body: t.Uint8Array(),
	})
	.post("/publish-map", async ({ bearer, body }) => {
		return createAsset(bearer, body);
	}, {
		body: t.Uint8Array(),
	})
	.listen(PORT);

console.log(`Server starting at ${app.server?.hostname}:${app.server?.port}`);

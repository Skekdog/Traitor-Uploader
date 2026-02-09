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

async function makeRequest<T>(url: string, method?: HTTPMethod, body?: BodyInit): Promise<RequestResponse<T>> {
	if (url.endsWith("/")) throw new Error("Must not have trailing slash...");

	const response = await fetch(url, {
		method: method,
		body: body,
		headers: {
			["x-api-key"]: env.ROBLOX_API_KEY,
		},
	});

	if (!response.ok) return new Promise(async (resolve) => {
		resolve({Ok: false, Result: await response.text(), Status: response.status})
	});

	return new Promise(async (resolve) => {
		resolve({Ok: true, Result: await response.json() as T, Status: response.status})
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

const app = new Elysia({
		serve: {
			maxRequestBodySize: MAX_REQUEST_SIZE
		}
	})
	.use(bearerAuth())
	.patch("/publish-map", async ({bearer, body}) => {
		// The first 8 bytes are used as the asset id

		if (!bearer) return status(401, "Unauthorized");
		if (bearer !== test) return status(403, "Forbidden");

		const assetId = new DataView(body.slice(0, 8).buffer, 0, 8).getFloat64(0, true);
		const assetContent = body.slice(8);

		const formData = createFileForm(assetContent, "asset.rbxm", "model/x-rbxm");

		const request: AssetUpdateRequest = {
			assetId: assetId
		}

		formData.append("request", JSON.stringify(request));

		const operation = await makeRequest<Operation<AssetResponse>>(`https://apis.roblox.com/assets/v1/assets/${assetId}`, "PATCH", formData);
		if (!operation.Ok) return status(operation.Status, operation.Result);

		const response = await poll("https://apis.roblox.com/assets/v1/", operation.Result);
		return status(200, response.Result.toString());
	}, {
		body: t.Uint8Array(),
	})
	.post("/publish-map", async ({ bearer, body }) => {
		if (!bearer) return status(401, "Unauthorized");
		if (bearer !== test) return status(403, "Forbidden");

		const formData = new FormData();

		// const formData = createFileForm(body, "asset.rbxm", "model/x-rbxm");

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

		formData.append("fileContent", new File([body], "asset.rbxm", { type: "model/x-rbxm" }));

		const operation = await makeRequest<Operation<AssetResponse>>("https://apis.roblox.com/assets/v1/assets", "POST", formData);
		if (!operation.Ok) return status(operation.Status, operation.Result);

		const response = await poll("https://apis.roblox.com/assets/v1/", operation.Result);
		return status(200, response.Result.toString());
	}, {
		body: t.Uint8Array(),
	})
	.listen(PORT);

console.log(`Server starting at ${app.server?.hostname}:${app.server?.port}`);

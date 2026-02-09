import { bearer as bearerAuth } from "@elysiajs/bearer";
import Elysia, { form, status, t, type HTTPMethod } from "elysia";
import { env } from "./env";
import type { BodyInit } from "bun";

const PORT = 31352;

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

// Incomplete because I don't care about the other fields
type AssetResponse = {
	assetId: number,
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

const app = new Elysia()
	.use(bearerAuth())
	.post("/publish-map", async ({ bearer, body }) => {
		if (!bearer) return status(401, "Unauthorized");

		if (bearer !== test) return status(403, "Forbidden");

		const formData = new FormData();

		const request = {
			assetType: "Model",
			displayName: "Test",
			description: "Test description",
			creationContext: {
				creator: {
					userId: 10474615021,
				},
			},
			assetId: 81237358985439,
		};

		formData.append("request", JSON.stringify(request));

		const mapFile = new File([body], "test.rbxm", { type: "model/x-rbxm" });
		formData.append("fileContent", mapFile);

		const operation = await makeRequest<Operation<AssetResponse>>("https://apis.roblox.com/assets/v1/assets/81237358985439", "PATCH", formData);

		if (!operation.Ok) return status(operation.Status, operation.Result);

		const response = await poll("https://apis.roblox.com/assets/v1/", operation.Result);

		return status(200, response.Result.toString());
	}, {
		body: t.Uint8Array(),
	})
	.listen(PORT);

console.log(`Web interface starting on port ${app.server?.hostname}:${app.server?.port}`);

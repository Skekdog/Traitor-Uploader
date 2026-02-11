import type { BodyInit } from "bun";
import type { HTTPMethod } from "elysia";
import { env } from "./env";

export type RequestResponse<T> = {
	Status: number,
} & ({
	Ok: true,
	Result: T,
} | {
	Ok: false,
	Result: string,
});

export type Operation<Response> = {
	path: string,
	operationId: string,
} & ({
	done: false,
	response: null,
} | {
	done: true,
	response: Response,
});

export function parseError(error: Record<string, any> | Record<string, any>[]): string {
	console.log(error);
	if (typeof error !== "object") return JSON.stringify(error);

	if (Array.isArray(error)) {
		let result = "";
		error.forEach(val => {
			result += parseError(val);
		});
		return result;
	}

	if (error.title) {
		// a v1 "detailed" error: https://create.roblox.com/docs/cloud/reference/errors#gateway-errors
		let details = "";
		if (error.errors) {
			for (const [key, value] of Object.entries(error.errors)) {
				details += key + ": " + value + "; ";
			}
			details = details.slice(0, -2);
		}

		return error.title + "{" + details + "}";
	} else if (error.message) {
		return error.message;
	} else if (error.errors) {
		return parseError(error.errors);
	}

	let details = "";
	for (const [key, value] of Object.entries(error)) {
		details += key + ": " + value + "; ";
	}
	details = details.slice(0, -2);

	return details ?? JSON.stringify(error);
}

export async function makeRequest<T>(url: string, method?: HTTPMethod, body?: BodyInit, contentType?: string): Promise<RequestResponse<T>> {
	if (url.endsWith("/")) throw new Error("Must not have trailing slash...");

	const headers = new Headers();
	headers.append("x-api-key", env.ROBLOX_API_KEY);

	if (contentType) headers.append("content-type", contentType);

	const response = await fetch(url, {
		method: method,
		body: body,
		headers: headers,
	});

	const text = await response.text() ?? response.statusText;
	const asObject = JSON.parse(text);

	if (!response.ok) return new Promise((resolve) => {
		resolve({Ok: false, Result: parseError(asObject), Status: response.status});
	});

	return new Promise((resolve) => {
		resolve({Ok: true, Result: asObject as T, Status: response.status});
	});
}

export async function poll<T>(basePath: string, operation: Operation<T>): Promise<RequestResponse<T>> {
	if (!basePath.endsWith("/")) throw new Error("moron");

	const response = await makeRequest<Operation<T>>(basePath + operation.path);
	if (!response.Ok) {
		return new Promise((resolve) => {
			resolve(response);
		});
	}

	const result = response.Result;
	if (!result.done) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(poll(basePath, operation));
			}, 1000);
		});
	}

	return new Promise((resolve) => {
		resolve({Ok: true, Status: response.Status, Result: response.Result.response!});
	});
}

export function createFileForm(data: Uint8Array, fileName: string, mimeType: string): FormData {
	const formData = new FormData();
	const file = new File([data], fileName, { type: mimeType });
	formData.append("fileContent", file);
	return formData;
}

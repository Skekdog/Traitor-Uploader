import { defineMiddleware, HTTPError } from "nitro";

const ALLOWED_UNAUTHORISED_ASSET_API_METHODS = ["GET", "PATCH"];

export default defineMiddleware((event) => {
	const authHeader = event.req.headers.get("authorization");

	if (authHeader?.startsWith("Bearer ")) {
		event.context.bearer = authHeader.substring(7);
	}

	const path = event.url.pathname;

	if (!path.startsWith("/api")) return;

	const isPublicEndpoint =
		/^\/api\/asset\/[^/]+$/.test(path) &&
		ALLOWED_UNAUTHORISED_ASSET_API_METHODS.includes(event.req.method); // i ❤️ regex

	if (isPublicEndpoint) return;

	if (!event.context.bearer) {
		throw new HTTPError({
			statusCode: 401,
			statusMessage: "Unauthorised",
		});
	}

	if (event.context.bearer !== process.env.WEB_PASSWORD) {
		throw new HTTPError({
			statusCode: 403,
			statusMessage: "Forbidden",
		});
	}
});

import { defineMiddleware, HTTPError } from "nitro";

export default defineMiddleware((event) => {
	const authHeader = event.req.headers.get("authorization");

	if (authHeader?.startsWith("Bearer ")) {
		event.context.bearer = authHeader.substring(7);
	}

	const path = event.url.pathname;

	if (!path.startsWith("/api")) return;

	const isPublicAsset =
		/^\/api\/asset\/[^/]+$/.test(path) && event.req.method === "GET"; // i ❤️ regex

	if (isPublicAsset) return;

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

import { defineMiddleware } from "nitro";

export default defineMiddleware((event) => {
	const authHeader = event.req.headers.get("authorization");
	if (authHeader?.startsWith("Bearer ")) {
		event.context.bearer = authHeader.substring(7);
	}
});

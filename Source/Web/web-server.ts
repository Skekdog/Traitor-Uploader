import staticPlugin from "@elysiajs/static";
import Elysia from "elysia";

const PORT = 443;

const app = new Elysia()
	.use(
		await staticPlugin({
			assets: "./Source/Web/Client",
			prefix: "/",
		})
	)
	.listen(PORT);

console.log(`Web interface starting at ${app.server?.hostname}:${app.server?.port}`);

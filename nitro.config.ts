import { defineConfig } from "nitro";

export default defineConfig({
	serverDir: "./src",
	experimental: {
		openAPI: true,
	},
	openAPI: {
		production: "runtime",
	},
	minify: true,
});

import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
	plugins: [
		nitro({
			serverDir: "./src",
			experimental: {
				openAPI: true,
			},
			openAPI: {
				production: "runtime",
			},
			minify: true,
		}),
	],
});

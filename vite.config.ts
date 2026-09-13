import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
	plugins: [
		{
			name: "nitro-assets-client-fix",
			enforce: "pre",
			resolveId(id) {
				if (id.includes("?assets=client")) {
					return "\0virtual:nitro-client-assets";
				}
			},
			load(id) {
				if (id === "\0virtual:nitro-client-assets") {
					return `
            export default {
              entry: "/app/page.js",
              css: [],
              js: []
            };
          `;
				}
			},
		},
		nitro({
			serverDir: "./src",
			serveStatic: true,
			experimental: {
				openAPI: true,
			},
			openAPI: {
				production: "runtime",
			},
			minify: true,
		}),
	],
	build: {
		outDir: ".output/public",
		rollupOptions: {
			input: "./src/app/page.ts",
			output: {
				entryFileNames: "app/page.js",
				format: "esm",
			},
		},
	},
});

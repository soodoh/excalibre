import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [
		starlight({
			title: "Excalibre Docs",
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Introduction", slug: "" },
						{ label: "Installation", slug: "getting-started" },
					],
				},
			],
		}),
	],
});

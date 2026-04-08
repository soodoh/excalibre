import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://docs.excalibre.dev",
	integrations: [
		starlight({
			title: "Excalibre Docs",
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Introduction", link: "/" },
						{ label: "Installation", link: "/getting-started/" },
					],
				},
			],
		}),
	],
});

/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "src/components/ui/sonner";
import appCss from "src/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		head: () => ({
			meta: [
				{ charSet: "utf8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ title: "Excalibre" },
			],
			links: [{ rel: "stylesheet", href: appCss }],
		}),
		component: RootComponent,
	},
);

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
			<Toaster />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

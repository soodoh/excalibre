import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import AppLayout from "src/components/layout/app-layout";
import { getAuthSessionFn } from "src/server/middleware";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const session = await getAuthSessionFn();
		if (!session) {
			// oxlint-disable-next-line only-throw-error
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
		return { session };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	return (
		<AppLayout>
			<Outlet />
		</AppLayout>
	);
}

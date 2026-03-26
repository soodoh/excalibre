import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSessionFn } from "src/server/middleware";

export const Route = createFileRoute("/_authed/settings/general")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn();
    if (!session || session.user.role !== "admin") {
      // eslint-disable-next-line only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">General Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Server configuration and authentication status.
      </p>
    </div>
  );
}

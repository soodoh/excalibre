import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSessionFn } from "src/server/middleware";

export const Route = createFileRoute("/_authed/settings/libraries")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn();
    if (!session || session.user.role !== "admin") {
      // eslint-disable-next-line only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: LibrariesSettingsPage,
});

function LibrariesSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Libraries</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your book libraries and scan paths.
      </p>
    </div>
  );
}

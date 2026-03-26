import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSessionFn } from "src/server/middleware";

export const Route = createFileRoute("/_authed/settings/scanning")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn();
    if (!session || session.user.role !== "admin") {
      // eslint-disable-next-line only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: ScanningSettingsPage,
});

function ScanningSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Scanning</h1>
      <p className="mt-2 text-muted-foreground">
        Configure scan intervals and trigger manual scans.
      </p>
    </div>
  );
}

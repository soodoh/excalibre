import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/scanning")({
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

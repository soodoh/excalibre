import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/libraries")({
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

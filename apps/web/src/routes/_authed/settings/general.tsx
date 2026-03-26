import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/general")({
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

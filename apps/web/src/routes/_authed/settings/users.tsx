import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/users")({
  component: UsersSettingsPage,
});

function UsersSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-2 text-muted-foreground">
        Manage users and library access.
      </p>
    </div>
  );
}

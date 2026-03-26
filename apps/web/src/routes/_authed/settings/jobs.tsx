import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/jobs")({
  component: JobsSettingsPage,
});

function JobsSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Jobs</h1>
      <p className="mt-2 text-muted-foreground">
        Monitor background job queue.
      </p>
    </div>
  );
}

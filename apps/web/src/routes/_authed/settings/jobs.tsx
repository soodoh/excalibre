import type { JSX } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAuthSessionFn } from "src/server/middleware";
import { getRecentJobsFn } from "src/server/conversion";
import { queryKeys } from "src/lib/query-keys";
import { Badge } from "src/components/ui/badge";

export const Route = createFileRoute("/_authed/settings/jobs")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn();
    if (!session || session.user.role !== "admin") {
      // eslint-disable-next-line only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: JobsSettingsPage,
});

type Job = {
  id: number;
  type: "scan" | "convert" | "epub_fix";
  status: "pending" | "running" | "completed" | "failed";
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return "Just now";
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

function formatDuration(
  startedAt: Date | null,
  completedAt: Date | null,
): string {
  if (!startedAt) {
    return "—";
  }
  const end = completedAt ?? new Date();
  const diffMs = end.getTime() - startedAt.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  const remainingSeconds = diffSeconds % 60;
  return `${diffMinutes}m ${remainingSeconds}s`;
}

function getJobDetails(job: Job): string {
  const payload = job.payload;
  if (!payload) {
    return job.type;
  }
  if (job.type === "convert") {
    const from =
      typeof payload.sourceFormat === "string"
        ? payload.sourceFormat.toUpperCase()
        : "?";
    const to =
      typeof payload.targetFormat === "string"
        ? payload.targetFormat.toUpperCase()
        : "?";
    return `${from} → ${to}`;
  }
  if (job.type === "epub_fix") {
    return "Fix EPUB";
  }
  if (job.type === "scan") {
    return "Library scan";
  }
  return job.type;
}

function TypeBadge({ type }: { type: Job["type"] }): JSX.Element {
  switch (type) {
    case "scan":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          scan
        </Badge>
      );
    case "convert":
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          convert
        </Badge>
      );
    case "epub_fix":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          epub_fix
        </Badge>
      );
  }
}

function StatusBadge({ status }: { status: Job["status"] }): JSX.Element {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">pending</Badge>;
    case "running":
      return (
        <Badge className="animate-pulse bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          running
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          completed
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          failed
        </Badge>
      );
  }
}

function JobsTable({ jobs }: { jobs: Job[] }): JSX.Element {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Details</th>
            <th className="px-4 py-3 text-left font-medium">Created</th>
            <th className="px-4 py-3 text-left font-medium">Duration</th>
            <th className="px-4 py-3 text-left font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <TypeBadge type={job.type} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {getJobDetails(job)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatRelativeTime(job.createdAt)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDuration(job.startedAt, job.completedAt)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {job.error ? (
                  <span
                    className="block max-w-[200px] truncate text-red-600 dark:text-red-400"
                    title={job.error}
                  >
                    {job.error}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobsContent({
  isLoading,
  jobs,
}: {
  isLoading: boolean;
  jobs: Job[] | undefined;
}): JSX.Element {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading jobs...</p>;
  }
  if (!jobs || jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">No jobs yet</p>;
  }
  return <JobsTable jobs={jobs} />;
}

function JobsSettingsPage(): JSX.Element {
  const { data: jobs, isLoading } = useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: async () => getRecentJobsFn(),
    refetchInterval: 5000,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Jobs</h1>
      <p className="mt-2 text-muted-foreground">
        Monitor background job queue.
      </p>

      <div className="mt-6">
        <JobsContent isLoading={isLoading} jobs={jobs as Job[] | undefined} />
      </div>
    </div>
  );
}

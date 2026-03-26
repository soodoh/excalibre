import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome to Excalibre</h1>
      <p className="mt-2 text-muted-foreground">
        Your library is empty. Go to Settings &rarr; Libraries to add a library
        and start scanning for books.
      </p>
    </div>
  );
}

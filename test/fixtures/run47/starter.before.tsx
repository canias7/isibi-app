import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/starter")({
  component: Unfinished,
  validateSearch: (search: Record<string, unknown>) => search,
});

function Unfinished() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Still being written
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        This page isn't finished yet
      </h1>
      <p className="text-muted-foreground">
        The rest of the site is live. Ask for this page again and it'll be written properly.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium"
      >
        Back to the home page
      </Link>
    </main>
  );
}

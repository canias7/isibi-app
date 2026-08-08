import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeatureGrid } from "@/components/ui/feature-grid";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);

  if (!member.isPending && member.data) {
    navigate({ to: "/records" });
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Halyard — the deals your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Every deal the team is chasing lives here, not scattered across inboxes. Add one, move it
            through a stage, and everyone on the team sees it update. Accounts are shared too, so nobody
            starts a new one from scratch.
          </p>
          <FeatureGrid
            className="mt-8"
            columns={2}
            items={[
              { title: "Shared pipeline", description: "The whole team reads and edits the same deals." },
              { title: "Shared accounts", description: "One list of companies, kept by everyone." },
              { title: "Full record view", description: "Header, fields and the activity trail, in one place." },
              { title: "No inbox required", description: "If it isn't in Halyard, it isn't happening." },
            ]}
          />
          <div className="mt-8 flex items-center gap-3 text-sm">
            <StatusBadge state="success">live</StatusBadge>
            <span className="text-muted-foreground">Built for sales teams of five to fifty.</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Sign in with your team account below.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          {mode === "login" ? (
            <LoginForm
              busy={login.isPending}
              error={error}
              onSubmit={(v) => {
                setError(null);
                login.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e) => setError(e.message),
                });
              }}
            />
          ) : (
            <SignupForm
              busy={signup.isPending}
              error={error}
              onSubmit={(v) => {
                setError(null);
                signup.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e) => setError(e.message),
                });
              }}
            />
          )}
          <button
            type="button"
            className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-4"
            onClick={() => {
              setError(null);
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            {mode === "login" ? "New to the team? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}

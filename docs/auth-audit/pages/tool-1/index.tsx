import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useMember, useLogin, useSignup } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (!member.isPending && member.data) {
    navigate({ to: "/records" });
    return null;
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One pipeline the whole sales team reads and edits together
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where the team keeps its deals and accounts — no
            spreadsheet, no separate inbox. Sign in and the team's work is
            right there, one table, one record at a time.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Every deal is shared with the team — nobody's pipeline is a silo</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Accounts are one shared list, built up by whoever adds one</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">reference</StatusBadge>
              <span>The team playbook sits alongside the records, kept up to date centrally</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Internal tool — sign in with your team account to see anything.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          {mode === "login" ? (
            <LoginForm
              busy={login.isPending}
              error={login.error?.message}
              onSubmit={(v) =>
                login.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e) => toast.error(e.message),
                })
              }
            />
          ) : (
            <SignupForm
              busy={signup.isPending}
              error={signup.error?.message}
              onSubmit={(v) =>
                signup.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e) => toast.error(e.message),
                })
              }
            />
          )}
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "New to the team? Create an account" : "Already have an account? Sign in"}
          </Button>
        </div>
      </section>
    </main>
  );
}

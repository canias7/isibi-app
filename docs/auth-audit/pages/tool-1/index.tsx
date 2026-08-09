import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { SafeImage } from "@/components/ui/safe-image";
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
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Halyard — one table your whole sales team reads
          </h1>
          <p className="mt-4 text-muted-foreground">
            Deals stay in one shared list, not five inboxes. Add a deal, move it through
            stages, and see what everyone else on the team is working — the same
            records, read by everyone signed in.
          </p>
          <SafeImage className="mt-8" src={null} alt="" ratio="16/10" fallbackSeed="halyard-hero" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>The team's deals, shared — everyone reads and edits the same rows</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared list of accounts anyone on the team can add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Playbook notes from management, right in the same tool</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Built for a small sales team — no marketing site attached, just the tool.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          {mode === "login" ? (
            <>
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Sign in</h2>
              <LoginForm
                busy={login.isPending}
                error={login.error?.message ?? null}
                onSubmit={(v) =>
                  login.mutate(v, {
                    onSuccess: () => navigate({ to: "/records" }),
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                New to the team?{" "}
                <Button variant="link" className="h-auto p-0" onClick={() => setMode("signup")}>
                  Create an account
                </Button>
              </p>
            </>
          ) : (
            <>
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Create an account</h2>
              <SignupForm
                busy={signup.isPending}
                error={signup.error?.message ?? null}
                onSubmit={(v) =>
                  signup.mutate(v, {
                    onSuccess: () => navigate({ to: "/records" }),
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Button variant="link" className="h-auto p-0" onClick={() => setMode("login")}>
                  Sign in
                </Button>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

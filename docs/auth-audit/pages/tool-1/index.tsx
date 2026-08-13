import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMember, useLogin, useSignup } from "@/lib/rows";
import { StatusBadge } from "@/components/ui/status-badge";
import { SafeImage } from "@/components/ui/safe-image";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (member.isPending) {
    return <main className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Checking your sign-in…</p></main>;
  }

  if (member.data) {
    navigate({ to: "/records" });
    return null;
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">One table your whole sales team reads</h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where the team keeps its deals and accounts — everyone signs in, sees the deals
            the team is working, adds their own, and reads the same shared list of accounts. No inbox,
            no spreadsheet, one record per deal.
          </p>
          <SafeImage className="mt-8" src={null} alt="" ratio="16/10" fallbackSeed="halyard-hero" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>Deals shared across the team — stage, value, who's on it</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>One shared list of accounts, everyone reads and adds to it</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="neutral">reference</StatusBadge><span>A shared playbook of how the team sells</span></li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">For the team only — sign in to see anything at all.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          {mode === "login" ? (
            <LoginForm
              busy={login.isPending}
              error={login.error?.message ?? null}
              onSubmit={(v) =>
                login.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                })
              }
            />
          ) : (
            <SignupForm
              busy={signup.isPending}
              error={signup.error?.message ?? null}
              onSubmit={(v) =>
                signup.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                })
              }
            />
          )}
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

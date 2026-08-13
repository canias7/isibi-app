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
    return null;
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where the team keeps its pipeline — deals move through
            stages, accounts are shared, and nobody has to ask "where are we
            with this one" in a channel again.
          </p>
          <SafeImage className="mt-8" src={null} alt="The team's deals, as a table" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Deals the whole team can see, filter and move forward</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared list of accounts everyone on the team can read</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Playbook guidance surfaced right next to the record</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Internal tool — sign in with the account your manager set you up with.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          {mode === "login" ? (
            <LoginForm
              busy={login.isPending}
              signupHref="#"
              onSubmit={(v) =>
                login.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e: Error) => toast.error(e.message),
                })
              }
            />
          ) : (
            <SignupForm
              busy={signup.isPending}
              loginHref="#"
              onSubmit={(v) =>
                signup.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e: Error) => toast.error(e.message),
                })
              }
            />
          )}
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </Button>
        </div>
      </section>
    </main>
  );
}

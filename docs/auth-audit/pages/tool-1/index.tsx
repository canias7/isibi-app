import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { StatsBand } from "@/components/ui/stats-band";
import { StatusBadge } from "@/components/ui/status-badge";

export const Route = createFileRoute("/")({ component: Door });

function Door() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (member.data) navigate({ to: "/records" });
  }, [member.data, navigate]);

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One table for every deal your team is working
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where the team keeps the pipeline — deals, stages and accounts in one
            shared surface, so nobody has to ask what stage something's at.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Every deal the team is working, in one table, edited where it's read</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared list of accounts everyone signed in can read and add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>A playbook the whole team reads, kept up to date by whoever runs the desk</span>
            </li>
          </ul>
          <div className="mt-8">
            <StatsBand
              columns={3}
              items={[
                { value: "1", label: "shared pipeline" },
                { value: "0", label: "spreadsheets" },
                { value: "24/7", label: "team visibility" },
              ]}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Built for small sales teams — this is a work tool, not a website.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          {mode === "login" ? (
            <LoginForm
              busy={login.isPending}
              error={login.error?.message ?? null}
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
              error={signup.error?.message ?? null}
              loginHref="#"
              onSubmit={(v) =>
                signup.mutate(v, {
                  onSuccess: () => navigate({ to: "/records" }),
                  onError: (e: Error) => toast.error(e.message),
                })
              }
            />
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New to Halyard?{" "}
                <button className="underline underline-offset-4" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already on the team?{" "}
                <button className="underline underline-offset-4" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

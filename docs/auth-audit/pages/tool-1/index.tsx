import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useLogin, useSignup, useLogout } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SafeImage } from "@/components/ui/safe-image";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const logout = useLogout();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its pipeline: deals the whole team
            reads and edits together, a shared list of accounts, and the playbook the
            business keeps up to date.
          </p>
          <SafeImage className="mt-8" src={null} alt="The team's deals, as a table" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Deals are shared — anyone on the team can open and move one</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>One shared list of accounts, kept by whoever adds to it</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">reference</StatusBadge>
              <span>The team's playbook, kept up to date by the business</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">No marketing site attached — this is the tool.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        {member.isPending && <p className="text-sm text-muted-foreground">Checking your sign-in…</p>}

        {!member.isPending && member.data && (
          <div className="w-full max-w-sm space-y-4 text-center">
            <p className="text-lg font-medium">Welcome back, {member.data.name}</p>
            <Button className="w-full" onClick={() => navigate({ to: "/records" })}>
              Go to records
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => logout.mutate()}>
              Sign out
            </Button>
          </div>
        )}

        {!member.isPending && !member.data && (
          <div className="w-full max-w-sm">
            {mode === "login" ? (
              <LoginForm
                busy={login.isPending}
                onSubmit={(v) =>
                  login.mutate(v, {
                    onSuccess: () => {
                      toast.success("Signed in.");
                      navigate({ to: "/records" });
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
            ) : (
              <SignupForm
                busy={signup.isPending}
                onSubmit={(v) =>
                  signup.mutate(v, {
                    onSuccess: () => {
                      toast.success("Account created.");
                      navigate({ to: "/records" });
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>
                  New to the team?{" "}
                  <button className="underline underline-offset-4" onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button className="underline underline-offset-4" onClick={() => setMode("login")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

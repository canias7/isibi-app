import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { StatsBand } from "@/components/ui/stats-band";
import { FeatureGrid } from "@/components/ui/feature-grid";
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
            Halyard is where the sales team keeps deals moving — one record per
            opportunity, shared accounts everyone can see, and a place to add a
            new deal the moment it lands.
          </p>
          <StatsBand
            className="mt-8"
            columns={3}
            items={[
              { value: "1", label: "shared pipeline" },
              { value: "0", label: "spreadsheets" },
              { value: "24/7", label: "visible to the team" },
            ]}
          />
          <FeatureGrid
            className="mt-8"
            columns={2}
            items={[
              { title: "Team pipeline", description: "Every deal the team is working, not just your own" },
              { title: "Shared accounts", description: "One list of accounts everyone reads and adds to" },
              { title: "Activity trail", description: "Each record keeps a log of what changed and when" },
              { title: "Playbook", description: "The team's own reference, kept up to date centrally" },
            ]}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          For the sales team only — sign in with your work account.
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
                  onSuccess: () => {
                    toast.success("Signed in");
                    navigate({ to: "/records" });
                  },
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
                  onSuccess: () => {
                    toast.success("Account created");
                    navigate({ to: "/records" });
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            />
          )}
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

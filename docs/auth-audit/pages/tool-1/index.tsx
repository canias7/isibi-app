import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatsBand } from "@/components/ui/stats-band";

export const Route = createFileRoute("/")({ component: Door });

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

function Door() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (member.data) {
      navigate({ to: "/records" });
    }
  }, [member.data, navigate]);

  const onSubmit = (values: Credentials) => {
    setError(null);
    const action = mode === "signin" ? login : signup;
    const payload = mode === "signin" ? values : { ...values, name: values.email.split("@")[0] };
    action.mutate(payload, {
      onSuccess: (data) => {
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        form.reset();
        navigate({ to: "/records" });
      },
      onError: (e) => setError(e.message),
    });
  };

  if (member.isPending || member.data) {
    return null;
  }

  const busy = login.isPending || signup.isPending;

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One shared table for every deal your team is working
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its pipeline — the deals
            everyone is chasing, the accounts everyone sells into, and the plays
            that work, all in one place instead of scattered across inboxes.
          </p>
          <StatsBand
            className="mt-8"
            columns={3}
            items={[
              { value: "1", label: "shared pipeline" },
              { value: "0", label: "spreadsheets left" },
              { value: "24/7", label: "team visibility" },
            ]}
          />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Every deal your team owns, in one table, with stage and value at a glance</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list — add one, everyone on the team sees it</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Playbook plays surfaced right on the deal that needs them</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams of two to ten — no admin console to configure before it's useful.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Sign in" : "Create an account"}</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Back to the pipeline in one field and a click."
                : "Join your team's shared pipeline."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="motion-press" disabled={busy}>
                  {busy ? "Signing in…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button type="button" className="underline underline-offset-4" onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button type="button" className="underline underline-offset-4" onClick={() => setMode("signin")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

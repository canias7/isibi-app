import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  if (!member.isPending && member.data) {
    navigate({ to: "/records" });
  }

  const action = mode === "login" ? login : signup;

  const onSubmit = (values: Credentials) => {
    setFormError(null);
    action.mutate(values, {
      onSuccess: (data) => {
        if (data && typeof data === "object" && "pending" in data) {
          setFormError("Check your authenticator app to finish signing in.");
          return;
        }
        navigate({ to: "/records" });
      },
      onError: (e) => setFormError(e.message),
    });
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            The team's deals, one table everyone reads
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its pipeline: every deal a shared
            record, every account a shared list, every change logged against the deal it
            happened on.
          </p>
          <StatsBand
            className="mt-8"
            columns={3}
            items={[
              { value: "1", label: "Shared pipeline" },
              { value: "1", label: "Shared account list" },
              { value: "0", label: "Spreadsheets left" },
            ]}
          />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Every deal the team is working, filterable by stage and value</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>One shared account list, so nobody chases the same lead twice</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Weekly digest of what moved, sent to the whole team</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams of five to fifteen. No admin console to configure first.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create your account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Back to the pipeline in one field and a click."
                : "Join the team already working these deals."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" placeholder="you@company.com" {...field} />
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
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <Button type="submit" className="motion-press" disabled={action.isPending}>
                  {action.isPending
                    ? mode === "login"
                      ? "Signing in…"
                      : "Creating account…"
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <button
                  type="button"
                  className="text-center text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() => {
                    setFormError(null);
                    setMode(mode === "login" ? "signup" : "login");
                  }}
                >
                  {mode === "login" ? "New to Halyard? Create an account" : "Already have an account? Sign in"}
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  const [mode, setMode] = useState<"login" | "signup">("login");

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const action = mode === "login" ? login : signup;

  const onSubmit = (values: Credentials) => {
    action.mutate(values, {
      onError: (e) => toast.error(e.message),
    });
  };

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">You're signed in as {member.data.name || member.data.email}.</p>
        <Button asChild>
          <Link to="/records">Go to the records</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal your team is working, one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its pipeline: deals move through
            stages, accounts are shared across the desk, and the playbook sits one click
            from the record it applies to.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>The team's deals in one table — everyone reads and edits the same rows</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list, built by whoever spots the lead first</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Every record carries its own activity trail</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams of five to fifteen — no seats to configure, no admin console to learn.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create an account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Back to the pipeline in one field and a click."
                : "Set a password and you're straight into the deals."}
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
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="motion-press" disabled={action.isPending}>
                  {action.isPending
                    ? mode === "login"
                      ? "Signing in…"
                      : "Creating…"
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-center text-xs text-muted-foreground underline underline-offset-4"
                >
                  {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

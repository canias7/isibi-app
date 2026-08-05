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
import { Skeleton } from "@/components/ui/skeleton";

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
      onSuccess: () => {
        form.reset();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  if (member.isPending) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Skeleton className="h-48 w-full max-w-sm rounded-xl" />
      </main>
    );
  }

  if (member.data) {
    return (
      <main className="grid min-h-screen place-items-center p-10">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>You're signed in</CardTitle>
            <CardDescription>Head to the pipeline to pick up where the team left off.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/records">Go to records</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            The deals your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its pipeline: every deal the
            team is chasing, a shared account list, and the plays that have worked
            before — all in one place instead of scattered across spreadsheets and
            inboxes.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Every deal the team is working, filterable and searchable</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list everyone can read and add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Pipeline forecasting straight off the table</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams of five to twenty — no admin dashboard to configure, just sign in.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create your account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Back to the pipeline in one field and a click."
                : "Join your team's workspace."}
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
                      : "Creating account…"
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {mode === "login" ? (
                    <>
                      New to the team?{" "}
                      <button
                        type="button"
                        className="underline underline-offset-4"
                        onClick={() => setMode("signup")}
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have one?{" "}
                      <button
                        type="button"
                        className="underline underline-offset-4"
                        onClick={() => setMode("login")}
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

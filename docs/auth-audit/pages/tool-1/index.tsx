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

  const onSubmit = (values: Credentials) => {
    const action = mode === "login" ? login : signup;
    action.mutate(
      mode === "login" ? values : { ...values, name: values.email.split("@")[0] },
      {
        onSuccess: () => {
          form.reset();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const pending = login.isPending || signup.isPending;

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Halyard — the deals your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            No inbox threads, no separate spreadsheet. Every deal the team is
            chasing sits in one record everyone can open, and the account list
            is shared so nobody re-types a company name twice.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>The team's deals in one table — stage, value, whoever's on it</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list everyone in the team can read and add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>A board view alongside the table, same records either way</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for small sales teams — nothing here is public, and nothing
          leaves the team.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        {member.isPending && (
          <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
        )}

        {!member.isPending && member.data && (
          <Card className="w-full max-w-sm motion-enter">
            <CardHeader>
              <CardTitle>You're signed in</CardTitle>
              <CardDescription>Head to the pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/records">Open records</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!member.isPending && !member.data && (
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>{mode === "login" ? "Sign in" : "Create an account"}</CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Back to the deals in one field and a click."
                  : "New here? Set a password and you're in."}
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
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="motion-press" disabled={pending}>
                    {pending
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
                    onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  >
                    {mode === "login" ? "New team? Create an account" : "Already have an account? Sign in"}
                  </button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}

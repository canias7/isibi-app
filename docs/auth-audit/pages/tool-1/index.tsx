import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SafeImage } from "@/components/ui/safe-image";

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

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  if (member.data) {
    navigate({ to: "/records" });
  }

  const action = mode === "login" ? login : signup;

  const onSubmit = (values: Credentials) => {
    action.mutate(values, {
      onSuccess: () => {
        form.reset();
        navigate({ to: "/records" });
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Halyard — the deals your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Every deal the team is chasing lands in one place — stage, value, whoever's on
            it — and the shared account list means nobody asks "who owns this client" in a
            channel again.
          </p>
          <SafeImage className="mt-8" src={null} alt="The team's pipeline, as a table" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>One table for every deal the team is working — filter it, don't hunt for it</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list everyone reads and adds to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Playbook notes surfaced right on the record you're working</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for a small sales team — no seats to configure, no admin console to learn.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create your account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Back to the team's deals in one field and a click."
                : "First time here? Set a password and you're in."}
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
                <button
                  type="button"
                  className="text-center text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "New to the team? Create an account" : "Already have an account? Sign in"}
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

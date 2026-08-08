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
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const submit = (action: typeof login, values: Credentials) => {
    setError(null);
    action.mutate(
      { ...values, name: values.email.split("@")[0] },
      {
        onSuccess: () => {
          form.reset();
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  if (member.isPending) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your sign-in…</main>;
  }

  if (member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You're signed in</h1>
        <p className="text-muted-foreground">Straight back to the deals your team is working.</p>
        <Button asChild>
          <Link to="/records">Go to records</Link>
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
            One shared table of deals — your whole sales team, one pipeline
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is the internal tool a small sales team runs on: every deal your
            team adds is a record everyone reads, every account is shared, and every
            edit leaves a trail on the record itself.
          </p>
          <SafeImage className="mt-8" src={null} alt="" ratio="16/10" fallbackSeed="halyard-hero" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>The team's deals, in one table — filter, search, open any one</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list everyone on the team can read and add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">reference</StatusBadge>
              <span>A playbook the business keeps up to date, for everyone to read</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Built for small sales teams who'd rather have one table than five spreadsheets.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Back to the team's deals in one field and a click.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit((v) => submit(login, v))}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" placeholder="you@yourteam.com" {...field} />
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-3">
                  <Button type="submit" className="motion-press" disabled={login.isPending}>
                    {login.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={signup.isPending}
                    onClick={form.handleSubmit((v) => submit(signup, v))}
                  >
                    {signup.isPending ? "Creating…" : "Create account"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

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
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  if (!member.isPending && member.data) {
    navigate({ to: "/records" });
  }

  const submit = (action: typeof login, values: Credentials) => {
    setError(null);
    action.mutate(values, {
      onSuccess: () => {
        form.reset();
        navigate({ to: "/records" });
      },
      onError: (e) => setError(e.message),
    });
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is the deal tracker for small sales teams. Everyone signs in,
            sees the same pipeline, adds their own deals, and keeps a shared list
            of accounts — no spreadsheet, no separate inbox.
          </p>
          <SafeImage
            className="mt-8"
            src={null}
            alt="The team's deals, laid out as a table"
            ratio="16/10"
          />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>One shared table — the whole team reads and edits the same deals</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A running list of accounts, built up by everyone who signs in</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Playbook notes the team can search from inside a record</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams of five to fifteen — no admin dashboard, no per-seat setup.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Back to the pipeline in one field and a click.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="grid gap-4"
                onSubmit={form.handleSubmit((v) => submit(login, v))}
              >
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
                    Create account
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { FeatureGrid } from "@/components/ui/feature-grid";

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
      onSuccess: (data) => {
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
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
            Halyard — one table your whole sales team reads
          </h1>
          <p className="mt-4 text-muted-foreground">
            Every deal your team is working sits in one shared table, with a record
            behind each row: the stage, the value, and the full activity trail. Add
            a deal, move it forward, and everyone sees it change.
          </p>
          <div className="mt-8">
            <FeatureGrid
              columns={2}
              items={[
                { title: "Shared pipeline", description: "Every deal the team is working, in one table" },
                { title: "Own accounts", description: "A shared list of accounts anyone can add to" },
                { title: "One record view", description: "Header, fields and trail — edit where you read" },
                { title: "No inbox digging", description: "The playbook lives in the tool, not in email" },
              ]}
            />
          </div>
          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Deals, filterable by stage, shared across the whole team</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Accounts anyone on the team can add and read</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">read-only</StatusBadge>
              <span>A team playbook, maintained by whoever runs the tool</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Built for small sales teams — no marketing site attached.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Back to the pipeline in a couple of fields.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit((v) => submit(login, v))}>
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

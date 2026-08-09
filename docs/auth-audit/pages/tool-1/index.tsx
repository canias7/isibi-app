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

  if (!member.isPending && member.data) {
    navigate({ to: "/records" });
  }

  const submit = (values: Credentials) => {
    const action = mode === "login" ? login : signup;
    const payload = mode === "login" ? values : { ...values, name: values.email.split("@")[0] };
    action.mutate(payload, {
      onSuccess: (data) => {
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        form.reset();
        navigate({ to: "/records" });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal the team is working, one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its deals honest — everyone signs in, sees
            the same pipeline, adds a deal, and the whole team reads what changed and when.
          </p>
          <SafeImage className="mt-8" src={null} alt="The team's deals, as a table" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>One shared list of deals — no spreadsheet, no "whose copy is newest"</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account book everyone on the team can add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Stage automation and quote templates</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams of five to fifteen. No public pages, no marketing — just the tool.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create an account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Back to the pipeline in one field and a click."
                : "Join your team's workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" placeholder="you@team.co" {...field} />
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
                <Button type="submit" className="motion-press" disabled={login.isPending || signup.isPending}>
                  {mode === "login"
                    ? login.isPending
                      ? "Signing in…"
                      : "Sign in"
                    : signup.isPending
                      ? "Creating…"
                      : "Create account"}
                </Button>
                <button
                  type="button"
                  className="text-center text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
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

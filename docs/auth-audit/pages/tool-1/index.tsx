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

export const Route = createFileRoute("/")({ component: Home });

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

function Home() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  if (member.data) {
    navigate({ to: "/records" });
  }

  const onSubmit = (values: Credentials) => {
    setError(null);
    if (mode === "login") {
      login.mutate(values, {
        onSuccess: () => {
          form.reset();
          navigate({ to: "/records" });
        },
        onError: (e) => {
          setError(e.message);
          toast.error(e.message);
        },
      });
    } else {
      signup.mutate(
        { ...values, name: name || values.email.split("@")[0] },
        {
          onSuccess: () => {
            form.reset();
            navigate({ to: "/records" });
          },
          onError: (e) => {
            setError(e.message);
            toast.error(e.message);
          },
        },
      );
    }
  };

  const busy = login.isPending || signup.isPending;

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One table for every deal your team is working
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is the shared pipeline for a small sales team: every deal, every
            account and the plays that work, in one place everyone reads from and
            writes to together.
          </p>
          <FeatureGrid
            className="mt-8"
            columns={2}
            items={[
              { title: "Shared deals", description: "Your whole team sees and edits the same pipeline" },
              { title: "Shared accounts", description: "One list of who you're selling to, kept current" },
              { title: "The playbook", description: "Guidance the business keeps up to date, always visible" },
              { title: "Your own signal", description: "Add a deal in seconds, from wherever you are" },
            ]}
          />
          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Search and filter the deals your team is working right now</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Open any deal to its own record — fields and history together</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for teams who'd rather sign in than sign up for another inbox.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create an account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Back to the pipeline in a field and a click."
                : "Join your team's Halyard in a minute."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="hy-name">
                  Name
                </label>
                <Input
                  id="hy-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Reyes"
                />
              </div>
            )}
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="motion-press" disabled={busy}>
                  {busy
                    ? mode === "login"
                      ? "Signing in…"
                      : "Creating account…"
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>
              </form>
            </Form>
            <p className="text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>
                  New here?{" "}
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
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

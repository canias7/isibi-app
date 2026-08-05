import { createFileRoute, Link } from "@tanstack/react-router";
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
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const submit = (action: typeof login, values: Credentials) => {
    setFormError(null);
    action.mutate(values, {
      onSuccess: (data) => {
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        form.reset();
      },
      onError: (e) => {
        setFormError(e.message);
        toast.error(e.message);
      },
    });
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One table for every deal your team is working
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is the shared pipeline for small sales teams: deals live in
            one record, the whole team reads and edits the same rows, and the
            accounts you sell into are never scattered across five inboxes.
          </p>
          <SafeImage
            className="mt-8"
            src={null}
            alt="The team's deals, as a table"
            ratio="16/10"
          />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>The team's deals in one table — search, filter, open any record</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared list of accounts everyone can read and add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Deal stages rendered as a board, not just a table</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for small teams — no seats to configure, no admin console to learn.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {member.data
                ? `Signed in as ${member.data.name || member.data.email}.`
                : "Back to the team's pipeline in one field and a click."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {member.isPending && (
              <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
            )}

            {!member.isPending && member.data && (
              <Button asChild>
                <Link to="/records">Go to the records</Link>
              </Button>
            )}

            {!member.isPending && !member.data && (
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
                          <Input
                            type="password"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {formError && (
                    <p className="text-sm text-destructive motion-enter">{formError}</p>
                  )}
                  <div className="grid gap-2">
                    <Button
                      type="submit"
                      className="motion-press"
                      disabled={login.isPending}
                    >
                      {login.isPending ? "Signing in…" : "Sign in"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={signup.isPending}
                      onClick={form.handleSubmit((v) => submit(signup, v))}
                    >
                      {signup.isPending ? "Creating account…" : "Create an account"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const submit = (action: typeof login, values: Credentials) => {
    action.mutate(values, {
      onSuccess: (data) => {
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        navigate({ to: "/records" });
      },
      onError: () => toast.error("That email and password didn't match."),
    });
  };

  if (!member.isPending && member.data) {
    navigate({ to: "/records" });
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is the internal tool for a sales team that doesn't want a heavyweight CRM: deals move through stages, accounts are shared, and the playbook is a click away.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>The team's deals, filterable and searchable in one table</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>A shared account list everyone on the team can read and add to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Deal-to-deal activity trails, exportable to CSV</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          This is an internal tool, not a public site — sign in with your team account.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Get back to the pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            {member.isPending && <p className="text-sm text-muted-foreground">Checking your sign-in…</p>}
            {!member.isPending && (
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
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Trouble signing in? Ask whoever set up your team's Halyard.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

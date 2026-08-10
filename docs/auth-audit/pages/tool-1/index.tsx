import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
        form.reset();
        navigate({ to: "/records" });
      },
      onError: () => toast.error("That email and password didn't match."),
    });
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One shared pipeline, no spreadsheet copies
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where a small sales team keeps its deals and accounts. Everyone signs in,
            sees the deals the whole team is working, adds their own, and reads the same account
            list — nothing lives in someone's private sheet.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Deals are shared with your team — everyone reads and edits the same rows</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>One account list the whole team reads and adds to</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">soon</StatusBadge>
              <span>Kanban view of the pipeline, stage by stage</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for small teams — no admin console, no seat limits to argue about.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        {member.isPending && <Skeleton className="h-72 w-full max-w-sm rounded-xl" />}

        {!member.isPending && member.data && (
          <Card className="w-full max-w-sm motion-enter">
            <CardHeader>
              <CardTitle>You're signed in</CardTitle>
              <CardDescription>Welcome back, {member.data.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate({ to: "/records" })}>
                Go to records
              </Button>
            </CardContent>
          </Card>
        )}

        {!member.isPending && !member.data && (
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Back to the pipeline in one field and a click.</CardDescription>
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
                  <div className="flex gap-3">
                    <Button type="submit" className="motion-press flex-1" disabled={login.isPending}>
                      {login.isPending ? "Signing in…" : "Sign in"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
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
        )}
      </section>
    </main>
  );
}

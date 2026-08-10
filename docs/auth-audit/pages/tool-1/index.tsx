import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ActivityFeed } from "@/components/ui/activity-feed";

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
            One shared pipeline your whole sales team actually reads
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is where the team keeps the deals it's working and the
            accounts it sells into. Sign in to add a deal, move a stage, or
            check who spoke to who last.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">shared</StatusBadge>
              <span>Every deal is the team's, not one rep's private list</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Accounts are shared across the team the moment someone adds one</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="neutral">reference</StatusBadge>
              <span>The playbook — how the team qualifies and closes — lives right in the tool</span>
            </li>
          </ul>
          <div className="mt-8">
            <ActivityFeed
              items={[
                { who: "Priya", what: "moved Nettlefold Signage to Negotiation", at: new Date() },
                { who: "Dan", what: "added the account Foss & Kerr", at: new Date(Date.now() - 1000 * 60 * 40) },
              ]}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Internal tool — for the team, not for prospects.
        </p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {member.isPending
                ? "Checking your sign-in…"
                : member.data
                  ? `Signed in as ${member.data.name}.`
                  : "Use your team email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {member.data ? (
              <Button asChild>
                <Link to="/records">Go to the records</Link>
              </Button>
            ) : (
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
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      className="motion-press flex-1"
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
                      Create account
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

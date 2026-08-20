import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useLogin, useSignup, useLogout, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/account")({
  component: Account,
  head: () => ({
    meta: [
      { title: "Your account — Aurora Yoga" },
      { property: "og:title", content: "Your account — Aurora Yoga" },
      { name: "description", content: "Sign in to see studio announcements and manage your account." },
      { property: "og:description", content: "Sign in to see studio announcements and manage your account." },
    ],
  }),
});

type Announcement = Row & { title: string; body: string };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, six classes a week.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Notes", href: "/notes" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a class", href: "/book" },
};

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

function Account() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const logout = useLogout();

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
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-md px-6 py-16">
        {member.isPending && <p className="text-muted-foreground">Checking your sign-in…</p>}

        {member.data && <SignedIn name={member.data.name} onSignOut={() => logout.mutate()} />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in, or make an account, to see studio announcements and keep your notes.
            </p>

            <Form {...form}>
              <form className="mt-8 grid gap-4" onSubmit={form.handleSubmit((v) => submit(login, v))}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
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
                    Create an account
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}

function SignedIn({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {name}</h1>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      <div className="mt-4">
        <Link to="/notes" className="text-sm underline text-muted-foreground">
          Go to your notes
        </Link>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Studio announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <DataList
            query={announcements}
            className="grid gap-4"
            skeleton={2}
            empty={{ title: "No announcements right now", description: "Check back soon." }}
            error="Couldn't load announcements."
          >
            {(a) => (
              <div key={a.id} className="border-b border-border pb-3 last:border-none last:pb-0">
                <h3 className="font-medium">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
              </div>
            )}
          </DataList>
        </CardContent>
      </Card>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useLogin,
  useSignup,
  useLogout,
  useRows,
  useCreateRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/account")({ component: Account });

type Announcement = Row & { title: string; body: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down. Breathe. Move well.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Notes", href: "#/notes" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

const announcement = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().max(2000).optional(),
});

type AnnouncementForm = z.infer<typeof announcement>;

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

        {member.data && <SignedIn name={member.data.name} role={member.data.role} onSignOut={() => logout.mutate()} />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in, or make an account to see studio announcements.
            </p>

            <Form {...form}>
              <form
                className="mt-8 grid gap-4"
                onSubmit={form.handleSubmit((v) => submit(login, v))}
              >
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

function SignedIn({
  name,
  role,
  onSignOut,
}: {
  name: string;
  role: string;
  onSignOut: () => void;
}) {
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });
  const create = useCreateRow<Announcement>("announcements");
  const canWrite = role === "admin";

  const form = useForm<AnnouncementForm>({
    resolver: zodResolver(announcement),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: AnnouncementForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Posted");
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {name}</h1>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Studio announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.isPending && (
            <div className="grid gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          )}
          {announcements.isError && (
            <p className="text-sm text-destructive">Couldn't load announcements.</p>
          )}
          {announcements.data?.length === 0 && (
            <Empty title="No announcements yet" description="Studio news will show up here." />
          )}
          {!!announcements.data?.length && (
            <ul className="grid gap-3 motion-stagger">
              {announcements.data.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-4">
                  <p className="font-medium">{a.title}</p>
                  {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4 border-t border-border pt-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <Button type="submit" className="motion-press" disabled={create.isPending}>
                    {create.isPending ? "Posting…" : "Post announcement"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </>
  );
}

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { activityFeedFallback } from "@/lib/rows";

export const Route = createFileRoute("/account")({ component: Account });

type Note = Row & { title: string; body: string };
type Announcement = Row & { title: string; body: string };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, every day of the week.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "The studio", href: "#/work" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

const noteSchema = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().min(1, "Write something down"),
});

type NoteForm = z.infer<typeof noteSchema>;

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
      <div className="mx-auto max-w-2xl px-6 py-16">
        {member.isPending && <p className="text-muted-foreground">Checking your sign-in…</p>}

        {member.data && <SignedIn name={member.data.name} onSignOut={() => logout.mutate()} />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to keep your own practice notes, or make an account below.
            </p>

            <Form {...form}>
              <form
                className="mt-8 grid gap-4 max-w-md"
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

function SignedIn({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const notes = useRows<Note>("my_notes", { order: "id", dir: "desc" });
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });
  const create = useCreateRow<Note>("my_notes");

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: NoteForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Note saved");
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
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          )}
          {announcements.isError && (
            <p className="text-sm text-destructive">Couldn't load announcements.</p>
          )}
          {announcements.data?.length === 0 && (
            <Empty title="Nothing posted yet" description="Check back for studio updates and schedule changes." />
          )}
          {!!announcements.data?.length && (
            <ul className="grid gap-4 motion-stagger">
              {announcements.data.map((a) => (
                <li key={a.id} className="rounded-md border border-border p-4">
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your practice notes</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.isPending && (
            <div className="grid gap-2">
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          )}
          {notes.isError && <p className="text-sm text-destructive">Couldn't load your notes.</p>}
          {notes.data?.length === 0 && (
            <Empty title="No notes yet" description="Jot down how a class felt, or what to remember for next time." />
          )}
          {!!notes.data?.length && (
            <ul className="grid gap-3 motion-stagger">
              {notes.data.map((n) => (
                <li key={n.id} className="rounded-md border border-border p-4">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                </li>
              ))}
            </ul>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="After Tuesday's Vinyasa" {...field} />
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
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Hips felt tight, try a longer warm-up next time." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Button type="submit" className="motion-press" disabled={create.isPending}>
                  {create.isPending ? "Saving…" : "Save note"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

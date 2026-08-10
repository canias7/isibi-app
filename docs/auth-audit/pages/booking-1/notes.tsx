import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useDeleteRow, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { LoginForm } from "@/components/ui/login-form";
import { useLogin } from "@/lib/rows";

export const Route = createFileRoute("/notes")({ component: Notes });

type Note = Row & { title: string; body: string };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A studio in the city centre, breathing room every hour.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
    { label: "My notes", href: "/notes" },
  ],
  action: { label: "Book now", href: "/book" },
};

const note = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().min(1, "Write something"),
});

type NoteForm = z.infer<typeof note>;

function Notes() {
  const member = useMember();
  const login = useLogin();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-16">
        {member.isPending && <p className="text-muted-foreground">Checking your sign-in…</p>}

        {member.data && <SignedIn />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">My notes</h1>
            <p className="mt-2 text-muted-foreground">Sign in to keep your own practice notes.</p>
            <LoginForm
              className="mt-8"
              busy={login.isPending}
              onSubmit={(v) =>
                login.mutate(v, {
                  onError: () => toast.error("That email and password didn't match."),
                })
              }
            />
          </>
        )}
      </div>
    </SiteChrome>
  );
}

function SignedIn() {
  const notes = useRows<Note>("my_notes", { order: "id", dir: "desc" });
  const create = useCreateRow<Note>("my_notes");
  const remove = useDeleteRow("my_notes");

  const form = useForm<NoteForm>({
    resolver: zodResolver(note),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: NoteForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Note saved");
        form.reset();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">My notes</h1>
      <p className="mt-2 text-muted-foreground">Track what you're working on, class by class.</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4">
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
                <FormLabel>Note</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
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

      <div className="mt-10">
        {notes.isPending && (
          <div className="grid gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        )}
        {notes.isError && (
          <p className="text-sm text-destructive">Couldn't load your notes. Refresh and try again.</p>
        )}
        {notes.data?.length === 0 && (
          <Empty title="No notes yet" description="Save your first note above to start tracking your practice." />
        )}
        {!!notes.data?.length && (
          <div className="grid gap-3 motion-stagger">
            {notes.data.map((n) => (
              <Card key={n.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      remove.mutate(n.id, {
                        onSuccess: () => toast.success("Note deleted"),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    Delete
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

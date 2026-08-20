import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useRows,
  useCreateRow,
  useUpdateRow,
  useDeleteRow,
  type Row,
} from "@/lib/rows";
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
import { Textarea } from "@/components/ui/textarea";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/notes")({
  component: Notes,
  head: () => ({
    meta: [
      { title: "Your notes — Aurora Yoga" },
      { property: "og:title", content: "Your notes — Aurora Yoga" },
      { name: "description", content: "Keep your own private notes on your practice, visible only to you." },
      { property: "og:description", content: "Keep your own private notes on your practice, visible only to you." },
    ],
  }),
});

type Note = Row & { title: string; body: string };

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

const note = z.object({
  title: z.string().min(1, "Give it a title"),
  body: z.string().min(1, "Write something"),
});

type NoteForm = z.infer<typeof note>;

function Notes() {
  const member = useMember();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Your notes</h1>
        <p className="mt-2 text-muted-foreground">Private to you — nobody else sees these.</p>

        {member.isPending && <p className="mt-8 text-muted-foreground">Checking your sign-in…</p>}

        {!member.isPending && !member.data && (
          <div className="mt-8 rounded-xl border border-border bg-muted/40 p-6">
            <p className="text-sm text-muted-foreground">
              Sign in to keep your own notes on your practice.
            </p>
            <Button asChild className="mt-4">
              <Link to="/account">Sign in</Link>
            </Button>
          </div>
        )}

        {member.data && <NotesPanel />}
      </div>
    </SiteChrome>
  );
}

function NotesPanel() {
  const notes = useRows<Note>("my_notes", { order: "id", dir: "desc" });
  const create = useCreateRow<Note>("my_notes");
  const update = useUpdateRow<Note>("my_notes");
  const remove = useDeleteRow("my_notes");
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<NoteForm>({
    resolver: zodResolver(note),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: NoteForm) => {
    if (editingId != null) {
      update.mutate(
        { id: editingId, ...values },
        {
          onSuccess: () => {
            toast.success("Note updated");
            form.reset({ title: "", body: "" });
            setEditingId(null);
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
      return;
    }
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Note saved");
        form.reset({ title: "", body: "" });
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id as number);
    form.reset({ title: n.title, body: n.body });
  };

  const cancelEdit = () => {
    setEditingId(null);
    form.reset({ title: "", body: "" });
  };

  return (
    <>
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
          <div className="flex gap-2">
            <Button type="submit" className="motion-press" disabled={create.isPending || update.isPending}>
              {editingId != null
                ? update.isPending
                  ? "Saving…"
                  : "Save changes"
                : create.isPending
                  ? "Saving…"
                  : "Add note"}
            </Button>
            {editingId != null && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>

      <div className="mt-10">
        <DataList
          query={notes}
          className="grid gap-4"
          skeleton={3}
          empty={{ title: "No notes yet", description: "Add your first note above." }}
          error="Couldn't load your notes."
        >
          {(n) => (
            <Card key={n.id}>
              <CardHeader>
                <CardTitle className="text-base">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(n)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(n.id, {
                        onSuccess: () => toast.success("Note deleted"),
                        onError: (e: Error) => toast.error(e.message),
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </DataList>
      </div>
    </>
  );
}

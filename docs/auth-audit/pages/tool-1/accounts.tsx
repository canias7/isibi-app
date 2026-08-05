import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/accounts")({ component: Accounts });

type Account = Row & { name: string; website: string | null; notes: string | null };

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().min(1, "Add a website"),
  notes: z.string().max(1000).optional(),
});

type AccountForm = z.infer<typeof accountSchema>;

function Accounts() {
  const member = useMember();
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const create = useCreateRow<Account>("accounts");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
          <p className="mt-3 text-muted-foreground">Sign in to see the shared accounts.</p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const filtered = (accounts.data ?? []).filter((a) =>
    query ? a.name.toLowerCase().includes(query.toLowerCase()) : true,
  );

  const onSubmit = (values: AccountForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/40 p-6 md:flex md:flex-col md:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">Halyard</p>
          <nav className="mt-8 grid gap-1 text-sm">
            <Link
              to="/records"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-accent/50"
            >
              Deals
            </Link>
            <Link
              to="/accounts"
              className="rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground"
            >
              Accounts
            </Link>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as {member.data.name || member.data.email}
        </p>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared across the team — anyone can add one.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="motion-press">New record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Northwind Traders" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. northwind.example" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="motion-press" disabled={create.isPending}>
                    {create.isPending ? "Adding…" : "Add account"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search accounts…"
            count={filtered.length}
            total={accounts.data?.length}
          />
        </div>

        <div className="mt-6">
          {accounts.isPending && <Skeleton className="h-72 rounded-xl" />}

          {accounts.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the accounts. Refresh and try again.
            </p>
          )}

          {!accounts.isPending && !accounts.isError && accounts.data?.length === 0 && (
            <Empty
              title="No accounts yet"
              description="Add the first account your team sells into and it'll show up here for everyone."
            />
          )}

          {!accounts.isPending && !accounts.isError && !!accounts.data?.length && (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              empty="No accounts match your search."
              columns={[
                { key: "name", header: "Name", cell: (r) => r.name },
                {
                  key: "website",
                  header: "Website",
                  cell: (r) =>
                    r.website ? (
                      <a
                        href={r.website.startsWith("http") ? r.website : `https://${r.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.website}
                      </a>
                    ) : (
                      "—"
                    ),
                },
                { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
              ]}
            />
          )}
        </div>
      </main>
    </div>
  );
}

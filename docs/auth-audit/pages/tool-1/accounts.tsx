import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { SideNav } from "@/components/ui/side-nav";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  website: z.string().optional(),
  notes: z.string().optional(),
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

  const filtered = (accounts.data ?? []).filter((a) =>
    query.trim() ? a.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  const onCreate = (values: AccountForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        form.reset({ name: "", website: "", notes: "" });
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (!member.isPending && !member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Accounts are shared across the team. Sign in to see them.
            </p>
            <Button asChild className="mt-4">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <p className="mb-6 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          sections={[
            {
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/accounts" },
                { label: "Playbook", href: "/playbook" },
              ],
            },
          ]}
          active="/accounts"
        />
      </aside>

      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared across the whole team — anyone can add one.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input placeholder="https://" {...field} />
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

        <TableSearch
          className="mt-6"
          value={query}
          onChange={setQuery}
          placeholder="Search accounts"
          count={filtered.length}
          total={accounts.data?.length ?? 0}
        />

        <div className="mt-4">
          {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
          {accounts.isError && (
            <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
          )}
          {!accounts.isPending && !accounts.isError && filtered.length === 0 && (
            <Empty
              title="No accounts yet"
              description="Add the first account the team is working with."
            />
          )}
          {!accounts.isPending && !accounts.isError && filtered.length > 0 && (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              columns={[
                { key: "name", header: "Name", cell: (r) => r.name },
                {
                  key: "website",
                  header: "Website",
                  cell: (r) =>
                    r.website ? (
                      <a href={r.website} target="_blank" rel="noreferrer" className="underline">
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

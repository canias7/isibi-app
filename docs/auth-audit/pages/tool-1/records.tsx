import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useRows,
  useCreateRow,
  useUpdateRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { SideNav } from "@/components/ui/side-nav";
import { StatusBadge } from "@/components/ui/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/records")({
  component: Records,
  validateSearch: (search: Record<string, unknown>): { view?: string } => ({
    view: typeof search.view === "string" ? search.view : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a title"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function Records() {
  const member = useMember();
  const { view } = Route.useSearch();
  const section = view === "accounts" ? "accounts" : view === "playbook" ? "playbook" : "deals";

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
          <p className="mt-2 text-muted-foreground">
            Deals, accounts and the playbook are only visible once you're signed in.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-border p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={section === "deals" ? "deals" : section === "accounts" ? "accounts" : "playbook"}
          sections={[
            {
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/records?view=accounts" },
                { label: "Playbook", href: "/records?view=playbook" },
              ],
            },
          ]}
        />
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {section === "deals" && <DealsSurface />}
        {section === "accounts" && <AccountsSurface />}
        {section === "playbook" && <PlaybookSurface />}
      </main>
    </div>
  );
}

function DealsSurface() {
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });

  const filtered = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((r) => r.stage === stageFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const onSubmit = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const bulkSetStage = (stage: string) => {
    const ids = Array.from(selected);
    ids.forEach((id) => {
      update.mutate({ id, stage }, {
        onError: (e) => toast.error(e.message),
      });
    });
    toast.success(`Moved ${ids.length} deal${ids.length === 1 ? "" : "s"} to ${stage}`);
    setSelected(new Set());
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything the team is working, shared across the whole pipeline.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New record</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New deal</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input placeholder="£12,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="motion-press" disabled={create.isPending}>
                  {create.isPending ? "Adding…" : "Add deal"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search deals"
          count={filtered.length}
          total={deals.data?.length}
        />
        <FilterBar
          filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
          onRemove={() => setStageFilter(null)}
          onClear={() => setStageFilter(null)}
        >
          <Select value={stageFilter ?? "__all"} onValueChange={(v) => setStageFilter(v === "__all" ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      </div>

      {selected.size > 0 && (
        <BulkActions
          count={selected.size}
          onClear={() => setSelected(new Set())}
          actions={STAGES.map((s) => ({ label: `Move to ${s}`, onSelect: () => bulkSetStage(s) }))}
        />
      )}

      <div className="mt-4">
        {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
        {deals.isError && (
          <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
        )}
        {!deals.isPending && !deals.isError && filtered.length === 0 && (
          <Empty
            title={deals.data?.length === 0 ? "No deals yet" : "Nothing matches"}
            description={
              deals.data?.length === 0
                ? "Add the team's first deal to get the pipeline going."
                : "Try a different search or clear the stage filter."
            }
          />
        )}
        {!deals.isPending && !deals.isError && filtered.length > 0 && (
          <DataTable
            columns={[
              {
                key: "select",
                header: "",
                width: "2rem",
                cell: (row) => (
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggle(row.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
              },
              { key: "title", header: "Title", cell: (row) => row.title },
              { key: "value", header: "Value", cell: (row) => row.value ?? "—" },
              {
                key: "stage",
                header: "Stage",
                cell: (row) => <StatusBadge state={stageState(row.stage)}>{row.stage ?? "—"}</StatusBadge>,
              },
            ]}
            rows={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate({ to: "/record", search: { id: String(row.id) } })}
          />
        )}
      </div>
    </div>
  );
}

function AccountsSurface() {
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const create = useCreateRow<Account>("accounts");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filtered = useMemo(() => {
    const rows = accounts.data ?? [];
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [accounts.data, query]);

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
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across the team — anyone signed in can add one.
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
              <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                        <Input placeholder="acme.com" {...field} />
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
          placeholder="Search accounts"
          count={filtered.length}
          total={accounts.data?.length}
        />
      </div>

      <div className="mt-4">
        {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
        {accounts.isError && (
          <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
        )}
        {!accounts.isPending && !accounts.isError && filtered.length === 0 && (
          <Empty
            title={accounts.data?.length === 0 ? "No accounts yet" : "Nothing matches"}
            description={
              accounts.data?.length === 0
                ? "Add the first account the team is working with."
                : "Try a different search."
            }
          />
        )}
        {!accounts.isPending && !accounts.isError && filtered.length > 0 && (
          <DataTable
            columns={[
              { key: "name", header: "Name", cell: (row) => row.name },
              { key: "website", header: "Website", cell: (row) => row.website ?? "—" },
              { key: "notes", header: "Notes", cell: (row) => row.notes ?? "—" },
            ]}
            rows={filtered}
            rowKey={(row) => row.id}
          />
        )}
      </div>
    </div>
  );
}

function PlaybookSurface() {
  type Playbook = Row & { title: string; body: string | null };
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "desc" });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Maintained by the business — read here, edited from the dashboard.
      </p>
      <div className="mt-6">
        {playbook.isPending && <Skeleton className="h-48 rounded-xl" />}
        {playbook.isError && (
          <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
        )}
        {!playbook.isPending && !playbook.isError && playbook.data?.length === 0 && (
          <Empty title="No entries yet" description="The playbook is empty for now." />
        )}
        {!!playbook.data?.length && (
          <ul className="motion-stagger grid gap-4">
            {playbook.data.map((p) => (
              <li key={p.id} className="rounded-lg border border-border p-4">
                <h2 className="font-medium">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

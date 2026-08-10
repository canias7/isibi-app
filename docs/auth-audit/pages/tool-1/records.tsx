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
  useDeleteRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/records")({ component: Records });

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
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
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
  const [view, setView] = useState<"deals" | "accounts">("deals");

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="mt-3 text-muted-foreground">
          Sign in to see the team's deals and accounts.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/30 p-4 md:block">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <div className="mt-6">
          <SideNav
            active={view}
            sections={[
              {
                items: [
                  { label: "Deals", href: "#deals" },
                  { label: "Accounts", href: "#accounts" },
                ],
              },
            ]}
          />
        </div>
        <div className="mt-6 flex flex-col gap-1 px-2">
          <Button
            variant={view === "deals" ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setView("deals")}
          >
            Deals
          </Button>
          <Button
            variant={view === "accounts" ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setView("accounts")}
          >
            Accounts
          </Button>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        {view === "deals" ? <DealsPanel /> : <AccountsPanel />}
      </div>
    </div>
  );
}

function DealsPanel() {
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
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

  const onCreate = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onBulkStage = (stage: string) => {
    selected.forEach((id) => update.mutate({ id, stage } as Partial<Deal> & { id: number }));
    toast.success(`Moved ${selected.length} deal${selected.length === 1 ? "" : "s"} to ${stage}`);
    setSelected([]);
  };

  const onBulkDelete = () => {
    selected.forEach((id) => remove.mutate(id));
    toast.success(`Removed ${selected.length} deal${selected.length === 1 ? "" : "s"}`);
    setSelected([]);
  };

  return (
    <div className="p-6" id="deals">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone on the team reads and edits these rows.
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
              <form className="grid gap-4" onSubmit={form.handleSubmit(onCreate)}>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Nettlefold Signage — signage refit" {...field} />
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
                            <SelectValue placeholder="Choose one" />
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
          total={deals.data?.length ?? 0}
        />
        <FilterBar
          filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
          onRemove={() => setStageFilter(null)}
          onClear={() => setStageFilter(null)}
        >
          <Select
            value={stageFilter ?? "__all"}
            onValueChange={(v) => setStageFilter(v === "__all" ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All stages" />
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

      {selected.length > 0 && (
        <div className="mt-4">
          <BulkActions
            count={selected.length}
            onClear={() => setSelected([])}
            actions={[
              ...STAGES.map((s) => ({ label: `Move to ${s}`, onSelect: () => onBulkStage(s) })),
              { label: "Delete", onSelect: onBulkDelete, destructive: true },
            ]}
          />
        </div>
      )}

      <div className="mt-6">
        {deals.isPending && <Skeleton className="h-64 w-full rounded-xl" />}
        {deals.isError && (
          <p className="text-sm text-destructive">
            Couldn't load the deals. Refresh and try again.
          </p>
        )}
        {deals.data?.length === 0 && (
          <Empty
            title="No deals yet"
            description="Add the first deal the team is working."
          />
        )}
        {!!deals.data?.length && (
          <DataTable
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
            columns={[
              {
                key: "select",
                header: "",
                width: "2rem",
                cell: (r) => (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelected((prev) =>
                        prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
              },
              { key: "title", header: "Deal", cell: (r) => r.title },
              { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
              {
                key: "stage",
                header: "Stage",
                cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>,
              },
            ]}
            empty="No deals match those filters."
          />
        )}
      </div>
    </div>
  );
}

function AccountsPanel() {
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const create = useCreateRow<Account>("accounts");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filtered = useMemo(() => {
    let rows = accounts.data ?? [];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [accounts.data, query]);

  const onCreate = (values: AccountForm) => {
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
    <div className="p-6" id="accounts">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across the team — anyone can add one.
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
              <form className="grid gap-4" onSubmit={form.handleSubmit(onCreate)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Foss & Kerr Ltd" {...field} />
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
                        <Input placeholder="fossandkerr.co.uk" {...field} />
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
          total={accounts.data?.length ?? 0}
        />
      </div>

      <div className="mt-6">
        {accounts.isPending && <Skeleton className="h-64 w-full rounded-xl" />}
        {accounts.isError && (
          <p className="text-sm text-destructive">
            Couldn't load the accounts. Refresh and try again.
          </p>
        )}
        {accounts.data?.length === 0 && (
          <Empty
            title="No accounts yet"
            description="Add the first account the team is selling into."
          />
        )}
        {!!accounts.data?.length && (
          <DataTable
            rows={filtered}
            rowKey={(r) => r.id}
            columns={[
              { key: "name", header: "Account", cell: (r) => r.name },
              { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
              { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
            ]}
            empty="No accounts match that search."
          />
        )}
      </div>
    </div>
  );
}

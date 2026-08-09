import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { TableSearch } from "@/components/ui/table-search";
import { SideNav } from "@/components/ui/side-nav";
import { StatusBadge } from "@/components/ui/status-badge";
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

const dealForm = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealForm>;

function NewDealDialog() {
  const create = useCreateRow<Deal>("deals");
  const [open, setOpen] = useState(false);
  const form = useForm<DealForm>({
    resolver: zodResolver(dealForm),
    defaultValues: { title: "", value: "", stage: "New" },
  });

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="motion-press">New record</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                        <SelectValue placeholder="Choose a stage" />
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
  );
}

const accountForm = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});

type AccountForm = z.infer<typeof accountForm>;

function NewAccountDialog() {
  const create = useCreateRow<Account>("accounts");
  const [open, setOpen] = useState(false);
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountForm),
    defaultValues: { name: "", website: "", notes: "" },
  });

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="motion-press">New account</Button>
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
  );
}

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const filteredAccounts = useMemo(() => {
    let rows = accounts.data ?? [];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (a) => a.name.toLowerCase().includes(q) || (a.website ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [accounts.data, query]);

  if (member.isPending) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</main>;
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to see the team's deals and accounts.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
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
        <div className="mt-6 flex flex-col gap-2">
          <Button variant={view === "deals" ? "default" : "outline"} onClick={() => setView("deals")}>
            Deals
          </Button>
          <Button variant={view === "accounts" ? "default" : "outline"} onClick={() => setView("accounts")}>
            Accounts
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        {view === "deals" && (
          <section id="deals">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
                <p className="mt-1 text-sm text-muted-foreground">Every deal the team is working, shared across the team.</p>
              </div>
              <NewDealDialog />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search deals"
                count={filteredDeals.length}
                total={deals.data?.length}
              />
            </div>

            <FilterBar
              className="mt-3"
              filters={stageFilter ? [{ key: "stage", label: `Stage: ${stageFilter}` }] : []}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            >
              {STAGES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={stageFilter === s ? "default" : "outline"}
                  onClick={() => setStageFilter(stageFilter === s ? null : s)}
                >
                  {s}
                </Button>
              ))}
            </FilterBar>

            {selected.length > 0 && (
              <BulkActions
                className="mt-3"
                count={selected.length}
                onClear={() => setSelected([])}
                actions={[
                  {
                    label: "Clear selection",
                    onSelect: () => setSelected([]),
                  },
                ]}
              />
            )}

            {deals.isPending && <Skeleton className="mt-6 h-64 rounded-xl" />}
            {deals.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
            )}
            {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
              <Empty
                className="mt-6"
                title="No deals yet"
                description="Add the team's first deal to get the pipeline going."
              />
            )}
            {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
              <DataTable
                className="mt-6"
                rows={filteredDeals}
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
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelected((prev) =>
                            prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                          );
                        }}
                      />
                    ),
                  },
                  { key: "title", header: "Title", cell: (r) => r.title },
                  { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
                  {
                    key: "stage",
                    header: "Stage",
                    cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>,
                  },
                ]}
              />
            )}
          </section>
        )}

        {view === "accounts" && (
          <section id="accounts">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">Shared across the whole team — anyone can add one.</p>
              </div>
              <NewAccountDialog />
            </div>

            <div className="mt-6">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search accounts"
                count={filteredAccounts.length}
                total={accounts.data?.length}
              />
            </div>

            {accounts.isPending && <Skeleton className="mt-6 h-64 rounded-xl" />}
            {accounts.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
            )}
            {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
              <Empty
                className="mt-6"
                title="No accounts yet"
                description="Add the first account the team is working with."
              />
            )}
            {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
              <DataTable
                className="mt-6"
                rows={filteredAccounts}
                rowKey={(r) => r.id}
                columns={[
                  { key: "name", header: "Name", cell: (r) => r.name },
                  {
                    key: "website",
                    header: "Website",
                    cell: (r) =>
                      r.website ? (
                        <a
                          className="underline underline-offset-4"
                          href={r.website}
                          target="_blank"
                          rel="noreferrer"
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
          </section>
        )}
      </main>
    </div>
  );
}

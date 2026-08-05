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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { ResultCount } from "@/components/ui/result-count";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["lead", "qualified", "proposal", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "proposal" || stage === "qualified") return "warning";
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
  const [tab, setTab] = useState<"deals" | "accounts">("deals");

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to see the team's deals and accounts.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border p-6 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={tab}
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
          <Button variant={tab === "deals" ? "default" : "ghost"} onClick={() => setTab("deals")}>
            Deals
          </Button>
          <Button variant={tab === "accounts" ? "default" : "ghost"} onClick={() => setTab("accounts")}>
            Accounts
          </Button>
        </div>
      </aside>

      <main className="p-6 md:p-10">
        {tab === "deals" ? <DealsPanel /> : <AccountsPanel />}
      </main>
    </div>
  );
}

function DealsPanel() {
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const del = useDeleteRow("deals");
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "lead" },
  });

  const filtered = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((r) => r.stage === stageFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
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

  const onBulkDelete = () => {
    selected.forEach((id) => {
      del.mutate(id, {
        onError: (e) => toast.error(e.message),
      });
    });
    setSelected([]);
    toast.success("Removed from the pipeline");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">Our team's pipeline, shared and editable by everyone on it.</p>
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
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                          {...field}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </FormControl>
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

      <div className="mt-6 flex flex-wrap items-center gap-4">
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
      </div>

      <ResultCount className="mt-4" total={filtered.length} noun="deal" filtered={!!stageFilter || !!query} />

      {selected.length > 0 && (
        <BulkActions
          className="mt-4"
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[{ label: "Remove", onClick: onBulkDelete }]}
        />
      )}

      <div className="mt-4">
        {deals.isPending && <Skeleton className="h-64 w-full" />}
        {deals.isError && (
          <p className="text-sm text-destructive">Couldn't load the pipeline. Refresh and try again.</p>
        )}
        {!deals.isPending && !deals.isError && filtered.length === 0 && (
          <Empty title="No deals here yet" description="Add the team's first deal to get the pipeline started." />
        )}
        {!!filtered.length && (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="w-8 py-2"></th>
                <th className="py-2">Title</th>
                <th className="py-2">Value</th>
                <th className="py-2">Stage</th>
              </tr>
            </thead>
            <tbody className="motion-stagger">
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                  onClick={() => navigate({ to: "/record", search: { id: d.id } })}
                >
                  <td className="py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 font-medium">{d.title}</td>
                  <td className="py-2">{d.value ?? "—"}</td>
                  <td className="py-2">
                    <StatusBadge state={stageState(d.stage)}>{d.stage ?? "lead"}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      const q = query.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">Shared across the team — anyone here can read and add.</p>
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
                        <Input {...field} />
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

      <ResultCount className="mt-4" total={filtered.length} noun="account" filtered={!!query} />

      <div className="mt-4">
        {accounts.isPending && <Skeleton className="h-64 w-full" />}
        {accounts.isError && (
          <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
        )}
        {!accounts.isPending && !accounts.isError && filtered.length === 0 && (
          <Empty title="No accounts yet" description="Add the first account for the team to work from." />
        )}
        {!!filtered.length && (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Website</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="motion-stagger">
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2">{a.website ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{a.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

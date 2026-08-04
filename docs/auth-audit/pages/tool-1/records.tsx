import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Empty } from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSearch } from "@/components/ui/table-search";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

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

function stageState(stage: string | null): "success" | "warning" | "neutral" | "danger" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const [tab, setTab] = useState<"deals" | "accounts">("deals");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, search]);

  const filteredAccounts = useMemo(() => {
    let rows = accounts.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) => a.name.toLowerCase().includes(q) || (a.website ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [accounts.data, search]);

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(
      { title: values.title, value: values.value || null, stage: values.stage },
      {
        onSuccess: () => {
          toast.success("Deal added");
          dealForm.reset();
          setDealOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(
      { name: values.name, website: values.website || null, notes: values.notes || null },
      {
        onSuccess: () => {
          toast.success("Account added");
          accountForm.reset();
          setAccountOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the records</h1>
        <p className="max-w-sm text-muted-foreground">
          Deals and accounts are only visible to signed-in members of your team.
        </p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/30 p-4 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <button
            className={`rounded-md px-3 py-2 text-left ${tab === "deals" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => {
              setTab("deals");
              setSelected(new Set());
            }}
          >
            Deals
          </button>
          <button
            className={`rounded-md px-3 py-2 text-left ${tab === "accounts" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => {
              setTab("accounts");
              setSelected(new Set());
            }}
          >
            Accounts
          </button>
        </nav>
        <div className="mt-8 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Stage</p>
          <div className="mt-2 flex flex-col gap-1">
            <button
              className={`rounded-md px-3 py-1.5 text-left text-sm ${!stageFilter ? "bg-muted font-medium" : "hover:bg-muted"}`}
              onClick={() => setStageFilter(null)}
            >
              All stages
            </button>
            {STAGES.map((s) => (
              <button
                key={s}
                className={`rounded-md px-3 py-1.5 text-left text-sm capitalize ${stageFilter === s ? "bg-muted font-medium" : "hover:bg-muted"}`}
                onClick={() => setStageFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tab === "deals" ? "The team's deals" : "Shared accounts"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tab === "deals"
                ? "Every deal the team is working, in one shared table."
                : "Every account anyone on the team has added."}
            </p>
          </div>

          {tab === "deals" ? (
            <Dialog open={dealOpen} onOpenChange={setDealOpen}>
              <DialogTrigger asChild>
                <Button className="motion-press">New record</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New deal</DialogTitle>
                </DialogHeader>
                <Form {...dealForm}>
                  <form className="grid gap-4" onSubmit={dealForm.handleSubmit(onCreateDeal)}>
                    <FormField
                      control={dealForm.control}
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
                      control={dealForm.control}
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
                      control={dealForm.control}
                      name="stage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stage</FormLabel>
                          <FormControl>
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm capitalize"
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
                    <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                      {createDeal.isPending ? "Adding…" : "Add deal"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button className="motion-press">New record</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New account</DialogTitle>
                </DialogHeader>
                <Form {...accountForm}>
                  <form className="grid gap-4" onSubmit={accountForm.handleSubmit(onCreateAccount)}>
                    <FormField
                      control={accountForm.control}
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
                      control={accountForm.control}
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
                      control={accountForm.control}
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
                    <Button type="submit" className="motion-press" disabled={createAccount.isPending}>
                      {createAccount.isPending ? "Adding…" : "Add account"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder={tab === "deals" ? "Search deals…" : "Search accounts…"}
          />
          {tab === "deals" && (
            <FilterBar
              filters={[
                {
                  label: "Stage",
                  value: stageFilter ?? "all",
                  options: [{ label: "All", value: "all" }, ...STAGES.map((s) => ({ label: s, value: s }))],
                  onChange: (v) => setStageFilter(v === "all" ? null : v),
                },
              ]}
            />
          )}
          {selected.size > 0 && (
            <BulkActionsBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
            />
          )}
        </div>

        {tab === "deals" ? (
          <div className="mt-6">
            {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
            {deals.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the deals. Refresh and try again.
              </p>
            )}
            {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
              <Empty
                title="No deals yet"
                description="Add the first deal the team is working and it'll show up here for everyone."
              />
            )}
            {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="w-10 py-2"></th>
                    <th className="py-2 font-medium">Title</th>
                    <th className="py-2 font-medium">Value</th>
                    <th className="py-2 font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody className="motion-stagger">
                  {filteredDeals.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-2">
                        <Link to="/record" search={{ id: d.id, table: "deals" }} className="underline underline-offset-4">
                          {d.title}
                        </Link>
                      </td>
                      <td className="py-2">{d.value ?? "—"}</td>
                      <td className="py-2">
                        <StatusBadge state={stageState(d.stage)}>{d.stage ?? "new"}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="mt-6">
            {accounts.isPending && <Skeleton className="h-72 rounded-xl" />}
            {accounts.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the accounts. Refresh and try again.
              </p>
            )}
            {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
              <Empty
                title="No accounts yet"
                description="Add the first account and everyone on the team will see it."
              />
            )}
            {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Website</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="motion-stagger">
                  {filteredAccounts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="py-2">
                        <Link to="/record" search={{ id: a.id, table: "accounts" }} className="underline underline-offset-4">
                          {a.name}
                        </Link>
                      </td>
                      <td className="py-2">{a.website ?? "—"}</td>
                      <td className="max-w-xs truncate py-2 text-muted-foreground">{a.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function BulkActionsBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm">
      <span>{count} selected</span>
      <Button size="sm" variant="outline" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

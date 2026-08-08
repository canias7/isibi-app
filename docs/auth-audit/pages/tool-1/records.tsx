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
type PlaybookEntry = Row & { title: string; body: string | null };

const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a title"),
  value: z.string().optional(),
  stage: z.string().min(1),
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<"deals" | "accounts" | "playbook">("deals");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<PlaybookEntry>("playbook", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const updateDeal = useUpdateRow<Deal>("deals");

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

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setNewDealOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setNewAccountOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const bulkSetStage = (stage: string) => {
    selected.forEach((id) => {
      updateDeal.mutate(
        { id, values: { stage } },
        { onError: (e: Error) => toast.error(e.message) },
      );
    });
    toast.success(`Moved ${selected.length} deal${selected.length === 1 ? "" : "s"} to ${stage}`);
    setSelected([]);
  };

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the team's deals</h1>
        <p className="text-muted-foreground">Records are private to your team — sign in first.</p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={tab}
          sections={[
            {
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
                { label: "Playbook", href: "#playbook" },
              ],
            },
          ]}
        />
        <div className="mt-6 flex flex-col gap-1 px-2">
          <button
            onClick={() => setTab("deals")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${tab === "deals" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"}`}
          >
            Deals
          </button>
          <button
            onClick={() => setTab("accounts")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${tab === "accounts" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"}`}
          >
            Accounts
          </button>
          <button
            onClick={() => setTab("playbook")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${tab === "playbook" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"}`}
          >
            Playbook
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        {tab === "deals" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
              <Dialog open={newDealOpen} onOpenChange={setNewDealOpen}>
                <DialogTrigger asChild>
                  <Button className="motion-press">New record</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New deal</DialogTitle>
                  </DialogHeader>
                  <Form {...dealForm}>
                    <form onSubmit={dealForm.handleSubmit(onCreateDeal)} className="grid gap-4">
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
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                      <Button type="submit" disabled={createDeal.isPending} className="motion-press">
                        {createDeal.isPending ? "Adding…" : "Add deal"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Search deals"
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
              />
            </div>

            <FilterBar
              className="mt-3"
              filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            >
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStageFilter(stageFilter === s ? null : s)}
                  className={`rounded-full border px-3 py-1 text-xs ${stageFilter === s ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {s}
                </button>
              ))}
            </FilterBar>

            {selected.length > 0 && (
              <BulkActions
                className="mt-3"
                count={selected.length}
                onClear={() => setSelected([])}
                actions={STAGES.map((s) => ({
                  label: `Move to ${s}`,
                  onSelect: () => bulkSetStage(s),
                }))}
              />
            )}

            <div className="mt-4">
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the team's deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
                <Empty title="No deals yet" description="Add the team's first deal to get the pipeline started." />
              )}
              {!deals.isPending && !deals.isError && !!deals.data?.length && (
                <DataTable
                  rows={filteredDeals}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                  empty="No deals match that search."
                  columns={[
                    {
                      key: "select",
                      header: "",
                      width: "2.5rem",
                      cell: (r) => (
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id as number)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const id = r.id as number;
                            setSelected((prev) =>
                              e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
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
                      cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "new"}</StatusBadge>,
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}

        {tab === "accounts" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
              <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
                <DialogTrigger asChild>
                  <Button className="motion-press">New record</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New account</DialogTitle>
                  </DialogHeader>
                  <Form {...accountForm}>
                    <form onSubmit={accountForm.handleSubmit(onCreateAccount)} className="grid gap-4">
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
                              <Input placeholder="https://example.com" {...field} />
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
                      <Button type="submit" disabled={createAccount.isPending} className="motion-press">
                        {createAccount.isPending ? "Adding…" : "Add account"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-6">
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
              )}
              {!accounts.isPending && !accounts.isError && accounts.data?.length === 0 && (
                <Empty title="No accounts yet" description="Add the first account your team is working with." />
              )}
              {!accounts.isPending && !accounts.isError && !!accounts.data?.length && (
                <DataTable
                  rows={accounts.data}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "name", header: "Name", cell: (r) => r.name },
                    { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                  ]}
                />
              )}
            </div>
          </>
        )}

        {tab === "playbook" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">Kept up to date by the business — read only here.</p>
            <div className="mt-6">
              {playbook.isPending && <Skeleton className="h-64 rounded-xl" />}
              {playbook.isError && (
                <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
              )}
              {!playbook.isPending && !playbook.isError && playbook.data?.length === 0 && (
                <Empty title="Nothing published yet" description="The playbook will show up here once it's written." />
              )}
              {!playbook.isPending && !playbook.isError && !!playbook.data?.length && (
                <div className="grid gap-4 motion-stagger">
                  {playbook.data.map((p) => (
                    <div key={p.id} className="rounded-lg border border-border p-4">
                      <h2 className="font-medium">{p.title}</h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{p.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { SideNav } from "@/components/ui/side-nav";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResultCount } from "@/components/ui/result-count";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type PlaybookRow = Row & { title: string; body: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

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

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"deals" | "accounts" | "playbook">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<PlaybookRow>("playbook", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setNewDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setNewAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  if (!member.isPending && !member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to see the team's deals, accounts and playbook.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (member.isPending) {
    return (
      <main className="p-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-64 w-full" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active={tab}
          sections={[
            {
              items: [
                { label: "Our deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
                { label: "Playbook", href: "#playbook" },
              ],
            },
          ]}
        />
        <div className="mt-8 flex flex-col gap-2">
          <Button variant={tab === "deals" ? "default" : "outline"} onClick={() => setTab("deals")}>
            Deals
          </Button>
          <Button variant={tab === "accounts" ? "default" : "outline"} onClick={() => setTab("accounts")}>
            Accounts
          </Button>
          <Button variant={tab === "playbook" ? "default" : "outline"} onClick={() => setTab("playbook")}>
            Playbook
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {tab === "deals" && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
              <Dialog open={newDealOpen} onOpenChange={setNewDealOpen}>
                <DialogTrigger asChild>
                  <Button>New record</Button>
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
                              <Input placeholder="£4,500" {...field} />
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
                      <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                        {createDeal.isPending ? "Adding…" : "Add deal"}
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
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
              />
              <FilterBar
                filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
                onRemove={() => setStageFilter(null)}
                onClear={() => setStageFilter(null)}
              >
                <Select onValueChange={(v) => setStageFilter(v === "all" ? null : v)} value={stageFilter ?? "all"}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterBar>
            </div>

            <ResultCount className="mt-3" total={filteredDeals.length} noun="deal" filtered={!!stageFilter || !!query} />

            {selected.length > 0 && (
              <BulkActions
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

            {deals.isPending && <Skeleton className="mt-4 h-64 w-full" />}
            {deals.isError && (
              <p className="mt-4 text-sm text-destructive">Couldn't load the team's deals. Refresh and try again.</p>
            )}
            {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
              <Empty className="mt-4" title="No deals yet" description="Add the team's first deal to get the pipeline started." />
            )}
            {!deals.isPending && !deals.isError && !!deals.data?.length && (
              <DataTable
                className="mt-4"
                rowKey={(row) => row.id}
                rows={filteredDeals}
                onRowClick={(row) => navigate({ to: "/record", search: { id: String(row.id) } })}
                columns={[
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
          </>
        )}

        {tab === "accounts" && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
              <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
                <DialogTrigger asChild>
                  <Button>New record</Button>
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
            </div>

            {accounts.isPending && <Skeleton className="mt-4 h-64 w-full" />}
            {accounts.isError && (
              <p className="mt-4 text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
            )}
            {!accounts.isPending && !accounts.isError && accounts.data?.length === 0 && (
              <Empty className="mt-4" title="No accounts yet" description="Add the first account the team is talking to." />
            )}
            {!accounts.isPending && !accounts.isError && !!accounts.data?.length && (
              <DataTable
                className="mt-4"
                rowKey={(row) => row.id}
                rows={accounts.data}
                columns={[
                  { key: "name", header: "Name", cell: (r) => r.name },
                  { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                  { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                ]}
              />
            )}
          </>
        )}

        {tab === "playbook" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">Maintained by the team lead — read only here.</p>

            {playbook.isPending && <Skeleton className="mt-4 h-64 w-full" />}
            {playbook.isError && (
              <p className="mt-4 text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
            )}
            {!playbook.isPending && !playbook.isError && playbook.data?.length === 0 && (
              <Empty className="mt-4" title="No playbook entries yet" description="Nothing has been added by the team lead yet." />
            )}
            {!!playbook.data?.length && (
              <ul className="mt-6 space-y-4 motion-stagger">
                {playbook.data.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-4">
                    <h2 className="font-medium">{p.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

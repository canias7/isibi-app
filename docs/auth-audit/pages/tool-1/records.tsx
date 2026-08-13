import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SideNav } from "@/components/ui/side-nav";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type Playbook = Row & { title: string; body: string | null };

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

const CHROME = {
  name: "Halyard",
  tagline: "The team's deals and accounts, in one place.",
};

function Records() {
  const member = useMember();
  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "asc" });

  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [panel, setPanel] = useState<"deals" | "accounts" | "playbook">("deals");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filtered = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  if (member.isPending) {
    return (
      <SiteChrome {...CHROME}>
        <div className="p-10"><Skeleton className="h-64 rounded-xl" /></div>
      </SiteChrome>
    );
  }

  if (!member.data) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the records</h1>
          <p className="mt-3 text-muted-foreground">Deals and accounts are only visible to signed-in team members.</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/" })}>Go to sign in</Button>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0 border-r border-border p-4">
          <SideNav
            sections={[
              {
                title: "Records",
                items: [
                  { label: "Deals", href: "#" },
                  { label: "Accounts", href: "#" },
                  { label: "Playbook", href: "#" },
                ],
              },
            ]}
            active={panel === "deals" ? "Deals" : panel === "accounts" ? "Accounts" : "Playbook"}
          />
          <div className="mt-6 flex flex-col gap-1">
            <button className="text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => setPanel("deals")}>Deals</button>
            <button className="text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => setPanel("accounts")}>Accounts</button>
            <button className="text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => setPanel("playbook")}>Playbook</button>
          </div>
        </aside>

        <div className="flex-1 p-6">
          {panel === "deals" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
                <Dialog open={dealOpen} onOpenChange={setDealOpen}>
                  <DialogTrigger asChild>
                    <Button>New deal</Button>
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
                              <FormControl><Input {...field} /></FormControl>
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
                              <FormControl><Input placeholder="£5,000" {...field} /></FormControl>
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
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {STAGES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={createDeal.isPending}>
                          {createDeal.isPending ? "Adding…" : "Add deal"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <TableSearch value={query} onChange={setQuery} placeholder="Search deals" count={filtered.length} total={deals.data?.length ?? 0} />
              </div>

              <FilterBar
                className="mt-3"
                filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
                onRemove={() => setStageFilter(null)}
                onClear={() => setStageFilter(null)}
              >
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStageFilter(stageFilter === s ? null : s)}
                    className={`rounded-full border px-3 py-1 text-xs ${stageFilter === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    {s}
                  </button>
                ))}
              </FilterBar>

              {selected.size > 0 && (
                <BulkActions
                  count={selected.size}
                  onClear={() => setSelected(new Set())}
                  actions={[
                    { label: "Clear selection", onSelect: () => setSelected(new Set()) },
                  ]}
                />
              )}

              <div className="mt-4">
                {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
                {deals.isError && (
                  <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
                )}
                {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
                  <Empty title="No deals yet" description="Add the first deal the team is working." />
                )}
                {!deals.isPending && !deals.isError && (deals.data?.length ?? 0) > 0 && (
                  <DataTable<Deal>
                    rows={filtered}
                    rowKey={(r) => r.id}
                    onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                    columns={[
                      {
                        key: "select",
                        header: "",
                        width: "2.5rem",
                        cell: (r) => (
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(r.id)}
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
                  />
                )}
              </div>
            </>
          )}

          {panel === "accounts" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight">The team's accounts</h1>
                <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                  <DialogTrigger asChild>
                    <Button>New account</Button>
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
                              <FormControl><Input {...field} /></FormControl>
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
                              <FormControl><Input placeholder="https://" {...field} /></FormControl>
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
                              <FormControl><Textarea rows={3} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={createAccount.isPending}>
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
                  <Empty title="No accounts yet" description="Add the first account the team is selling into." />
                )}
                {!accounts.isPending && !accounts.isError && (accounts.data?.length ?? 0) > 0 && (
                  <DataTable<Account>
                    rows={accounts.data ?? []}
                    rowKey={(r) => r.id}
                    columns={[
                      { key: "name", header: "Account", cell: (r) => r.name },
                      { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                      { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                    ]}
                  />
                )}
              </div>
            </>
          )}

          {panel === "playbook" && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
              <p className="mt-2 text-sm text-muted-foreground">Maintained by the sales lead — read only.</p>
              <div className="mt-6 space-y-4">
                {playbook.isPending && <Skeleton className="h-40 rounded-xl" />}
                {playbook.isError && (
                  <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
                )}
                {!playbook.isPending && !playbook.isError && playbook.data?.length === 0 && (
                  <Empty title="Nothing here yet" description="The playbook hasn't been written yet." />
                )}
                {playbook.data?.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-4">
                    <h2 className="text-sm font-semibold">{p.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </SiteChrome>
  );
}

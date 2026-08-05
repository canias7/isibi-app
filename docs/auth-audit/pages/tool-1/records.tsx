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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResultCount } from "@/components/ui/result-count";
import { SideNav } from "@/components/ui/side-nav";
import {
  DataTable,
  type Column,
} from "@/components/ui/data-table";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type PlaybookEntry = Row & { title: string; body: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
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

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
        <p className="max-w-sm text-muted-foreground">
          Deals and accounts are only visible to signed-in team members.
        </p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return <RecordsWorkspace />;
}

function RecordsWorkspace() {
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc", limit: 100 });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc", limit: 100 });
  const playbook = useRows<PlaybookEntry>("playbook", { order: "id", dir: "asc", limit: 50 });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filtered = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, search]);

  const columns: Column<Deal>[] = [
    { key: "title", header: "Deal", render: (d) => <span className="font-medium">{d.title}</span> },
    { key: "value", header: "Value", render: (d) => d.value ?? "—" },
    {
      key: "stage",
      header: "Stage",
      render: (d) => <StatusBadge state={stageState(d.stage)}>{d.stage ?? "new"}</StatusBadge>,
    },
  ];

  const onDealSubmit = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline.");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onAccountSubmit = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added.");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active="deals"
          sections={[
            {
              title: "Pipeline",
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
                { label: "Playbook", href: "#playbook" },
              ],
            },
          ]}
        />
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone on the team reads and edits the same pipeline.
            </p>
          </div>
          <Dialog open={dealOpen} onOpenChange={setDealOpen}>
            <DialogTrigger asChild>
              <Button>New record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New deal</DialogTitle>
              </DialogHeader>
              <Form {...dealForm}>
                <form className="grid gap-4" onSubmit={dealForm.handleSubmit(onDealSubmit)}>
                  <FormField
                    control={dealForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme — annual renewal" {...field} />
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
                  <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                    {createDeal.isPending ? "Adding…" : "Add deal"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search deals"
            count={filtered.length}
            total={deals.data?.length}
          />
        </div>

        <FilterBar
          className="mt-3"
          filters={stageFilter ? [{ key: "stage", label: `Stage: ${stageFilter}` }] : []}
          onRemove={() => setStageFilter(null)}
          onClear={() => setStageFilter(null)}
        >
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStageFilter(stageFilter === s ? null : s)}
                className="motion-press"
              >
                <StatusBadge state={stageFilter === s ? stageState(s) : "neutral"}>{s}</StatusBadge>
              </button>
            ))}
          </div>
        </FilterBar>

        <div className="mt-4">
          <ResultCount total={filtered.length} noun="deal" filtered={!!stageFilter || !!search} />
        </div>

        {selected.length > 0 && (
          <BulkActions
            className="mt-3"
            count={selected.length}
            onClear={() => setSelected([])}
            actions={[{ label: "Clear selection", onClick: () => setSelected([]) }]}
          />
        )}

        <div className="mt-4">
          {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the pipeline. Refresh and try again.</p>
          )}
          {!deals.isPending && !deals.isError && filtered.length === 0 && (
            <Empty
              title={deals.data?.length === 0 ? "No deals yet" : "Nothing matches"}
              description={
                deals.data?.length === 0
                  ? "Add the team's first deal to start the pipeline."
                  : "Try a different search or clear the stage filter."
              }
            />
          )}
          {!deals.isPending && !deals.isError && filtered.length > 0 && (
            <DataTable
              data={filtered}
              columns={columns}
              getRowId={(d) => d.id}
              selected={selected}
              onSelectedChange={setSelected}
              onRowClick={(d) => navigate({ to: "/record", search: { id: d.id } })}
            />
          )}
        </div>

        <section id="accounts" className="mt-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">Shared across the team.</p>
            </div>
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">New account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New account</DialogTitle>
                </DialogHeader>
                <Form {...accountForm}>
                  <form className="grid gap-4" onSubmit={accountForm.handleSubmit(onAccountSubmit)}>
                    <FormField
                      control={accountForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Ltd" {...field} />
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
                            <Input placeholder="acme.com" {...field} />
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

          <div className="mt-4">
            {accounts.isPending && <Skeleton className="h-40 rounded-xl" />}
            {accounts.isError && (
              <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
            )}
            {accounts.data?.length === 0 && (
              <Empty title="No accounts yet" description="Add the first account the team is working." />
            )}
            {!!accounts.data?.length && (
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 motion-stagger">
                {accounts.data.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border p-4">
                    <p className="font-medium">{a.name}</p>
                    {a.website && <p className="text-sm text-muted-foreground">{a.website}</p>}
                    {a.notes && <p className="mt-2 text-sm text-muted-foreground">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section id="playbook" className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Playbook</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Guidance maintained by the business — read-only here.
          </p>
          <div className="mt-4">
            {playbook.isPending && <Skeleton className="h-40 rounded-xl" />}
            {playbook.isError && (
              <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
            )}
            {playbook.data?.length === 0 && (
              <Empty title="No playbook entries yet" description="Nothing has been published yet." />
            )}
            {!!playbook.data?.length && (
              <ul className="mt-2 grid gap-3 motion-stagger">
                {playbook.data.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-4">
                    <p className="font-medium">{p.title}</p>
                    {p.body && <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

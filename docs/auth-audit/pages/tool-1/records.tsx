import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useUpdateRow, type Row } from "@/lib/rows";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
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
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const updateDeal = useUpdateRow<Deal>("deals");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filteredDeals = useMemo(() => {
    const rows = deals.data ?? [];
    return rows
      .filter((d) => !stageFilter || d.stage === stageFilter)
      .filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase()));
  }, [deals.data, stageFilter, q]);

  const filteredAccounts = useMemo(() => {
    const rows = accounts.data ?? [];
    return rows.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()));
  }, [accounts.data, q]);

  if (member.isPending) return null;

  if (!member.data) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
        <p className="mt-2 text-muted-foreground">The deals and accounts your team is working live here, once you're signed in.</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
          Go to sign in
        </Button>
      </main>
    );
  }

  const onDealCreate = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onAccountCreate = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const bulkSetStage = (stage: string) => {
    selected.forEach((id) => updateDeal.mutate({ id, stage }));
    toast.success(`Moved ${selected.length} deal${selected.length === 1 ? "" : "s"} to ${stage}`);
    setSelected([]);
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <p className="px-2 text-sm font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={view}
          sections={[
            {
              title: "Records",
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
              ],
            },
          ]}
        />
        <div className="mt-6 flex flex-col gap-1">
          <button
            className={`rounded-md px-2 py-1.5 text-left text-sm ${view === "deals" ? "bg-muted font-medium" : "text-muted-foreground"}`}
            onClick={() => setView("deals")}
          >
            Deals
          </button>
          <button
            className={`rounded-md px-2 py-1.5 text-left text-sm ${view === "accounts" ? "bg-muted font-medium" : "text-muted-foreground"}`}
            onClick={() => setView("accounts")}
          >
            Accounts
          </button>
        </div>
        {view === "deals" && (
          <div className="mt-6">
            <p className="px-2 text-xs font-medium text-muted-foreground">Stage</p>
            <div className="mt-2 flex flex-col gap-1">
              <button
                className={`rounded-md px-2 py-1.5 text-left text-sm ${!stageFilter ? "bg-muted font-medium" : "text-muted-foreground"}`}
                onClick={() => setStageFilter(null)}
              >
                All stages
              </button>
              {STAGES.map((s) => (
                <button
                  key={s}
                  className={`rounded-md px-2 py-1.5 text-left text-sm ${stageFilter === s ? "bg-muted font-medium" : "text-muted-foreground"}`}
                  onClick={() => setStageFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{view === "deals" ? "Our deals" : "Accounts"}</h1>
          {view === "deals" ? (
            <Dialog open={dealOpen} onOpenChange={setDealOpen}>
              <DialogTrigger asChild>
                <Button className="motion-press">New record</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New deal</DialogTitle>
                </DialogHeader>
                <Form {...dealForm}>
                  <form onSubmit={dealForm.handleSubmit(onDealCreate)} className="grid gap-4">
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
                            <Input placeholder="£5,000" {...field} />
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
                    <Button type="submit" disabled={createDeal.isPending} className="motion-press">
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
                  <form onSubmit={accountForm.handleSubmit(onAccountCreate)} className="grid gap-4">
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
                    <Button type="submit" disabled={createAccount.isPending} className="motion-press">
                      {createAccount.isPending ? "Adding…" : "Add account"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <TableSearch value={q} onChange={setQ} placeholder={view === "deals" ? "Search deals" : "Search accounts"} count={view === "deals" ? filteredDeals.length : filteredAccounts.length} total={view === "deals" ? (deals.data?.length ?? 0) : (accounts.data?.length ?? 0)} />
          {view === "deals" && stageFilter && (
            <FilterBar filters={[{ key: "stage", label: stageFilter }]} onRemove={() => setStageFilter(null)} onClear={() => setStageFilter(null)} />
          )}
          {view === "deals" && selected.length > 0 && (
            <BulkActions
              count={selected.length}
              onClear={() => setSelected([])}
              actions={STAGES.map((s) => ({ label: `Move to ${s}`, onSelect: () => bulkSetStage(s) }))}
            />
          )}
        </div>

        <div className="mt-6">
          {view === "deals" ? (
            <>
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty title="No deals yet" description="Add the team's first deal to get the pipeline started." />
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
                <DataTable
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                  columns={[
                    {
                      key: "sel",
                      header: "",
                      width: "2rem",
                      cell: (r) => (
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setSelected((prev) =>
                              e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
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
                  rows={filteredDeals}
                />
              )}
            </>
          ) : (
            <>
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
                <Empty title="No accounts yet" description="Add the first account the team is working with." />
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
                <DataTable
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "name", header: "Name", cell: (r) => r.name },
                    {
                      key: "website",
                      header: "Website",
                      cell: (r) =>
                        r.website ? (
                          <a className="underline underline-offset-4" href={r.website} target="_blank" rel="noreferrer">
                            {r.website}
                          </a>
                        ) : (
                          "—"
                        ),
                    },
                    { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                  ]}
                  rows={filteredAccounts}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

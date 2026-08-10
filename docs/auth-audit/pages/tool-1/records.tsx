import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Link } from "@tanstack/react-router";

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

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" | "quiet" {
  switch (stage) {
    case "Won":
      return "success";
    case "Lost":
      return "danger";
    case "Negotiation":
    case "Proposal":
      return "warning";
    default:
      return "neutral";
  }
}

function Records() {
  const member = useMember();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const updateDeal = useUpdateRow<Deal>("deals");
  const deleteDeal = useDeleteRow("deals");

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((r) => r.stage === stageFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const onCreate = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const bulkSetStage = (stage: string) => {
    selected.forEach((id) => {
      updateDeal.mutate({ id, stage } as Partial<Deal> & { id: number });
    });
    toast.success(`Moved ${selected.length} to ${stage}`);
    setSelected([]);
  };

  const bulkDelete = () => {
    selected.forEach((id) => deleteDeal.mutate(id));
    toast.success(`Removed ${selected.length} deal${selected.length === 1 ? "" : "s"}`);
    setSelected([]);
  };

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
          <p className="mt-2 text-muted-foreground">Halyard's records are for the team only.</p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </div>
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
        <div className="mt-6 grid gap-1">
          <Button variant={view === "deals" ? "default" : "ghost"} className="justify-start" onClick={() => setView("deals")}>
            Deals
          </Button>
          <Button variant={view === "accounts" ? "default" : "ghost"} className="justify-start" onClick={() => setView("accounts")}>
            Accounts
          </Button>
        </div>
        {view === "deals" && (
          <div className="mt-6 grid gap-1">
            <p className="px-2 text-xs font-medium uppercase text-muted-foreground">Stage</p>
            <Button variant={stageFilter === null ? "secondary" : "ghost"} className="justify-start" onClick={() => setStageFilter(null)}>
              All stages
            </Button>
            {STAGES.map((s) => (
              <Button
                key={s}
                variant={stageFilter === s ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => setStageFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
      </aside>

      <main className="flex-1 p-6">
        {view === "deals" && (
          <div>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
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
                              <Input placeholder="£5,000" {...field} />
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
                      <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                        {createDeal.isPending ? "Adding…" : "Add deal"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search deals"
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
              />
              {stageFilter && (
                <FilterBar
                  filters={[{ key: "stage", label: `Stage: ${stageFilter}` }]}
                  onRemove={() => setStageFilter(null)}
                  onClear={() => setStageFilter(null)}
                />
              )}
            </div>

            {selected.length > 0 && (
              <div className="mt-4">
                <BulkActions
                  count={selected.length}
                  onClear={() => setSelected([])}
                  actions={[
                    ...STAGES.map((s) => ({ label: `Move to ${s}`, onSelect: () => bulkSetStage(s) })),
                    { label: "Delete", onSelect: bulkDelete, destructive: true },
                  ]}
                />
              </div>
            )}

            <div className="mt-4">
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
                <Empty title="No deals yet" description="Add the team's first deal to get the pipeline going." />
              )}
              {!deals.isPending && !deals.isError && !!deals.data?.length && (
                <DataTable
                  rows={filteredDeals}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                  columns={[
                    {
                      key: "select",
                      header: "",
                      width: "32px",
                      cell: (r) => (
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelected((cur) =>
                              e.target.checked ? [...cur, r.id] : cur.filter((id) => id !== r.id),
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
                />
              )}
            </div>
          </div>
        )}

        {view === "accounts" && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Shared across the whole team.</p>
            <div className="mt-4">
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
              )}
              {!accounts.isPending && !accounts.isError && accounts.data?.length === 0 && (
                <Empty title="No accounts yet" description="Accounts your team adds will show up here." />
              )}
              {!accounts.isPending && !accounts.isError && !!accounts.data?.length && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">All accounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      rows={accounts.data}
                      rowKey={(r) => r.id}
                      columns={[
                        { key: "name", header: "Name", cell: (r) => r.name },
                        { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                        { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                      ]}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

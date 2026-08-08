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
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give it a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc", limit: 8 });
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "desc", limit: 5 });
  const create = useCreateRow<Deal>("deals");
  const del = useDeleteRow("deals");

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });

  const filtered = useMemo(() => {
    let rows = deals.data ?? [];
    if (stage) rows = rows.filter((d) => d.stage === stage);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stage, query]);

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

  const onBulkDelete = () => {
    selected.forEach((id) => del.mutate(id));
    toast.success(`Removed ${selected.length} deal${selected.length === 1 ? "" : "s"}`);
    setSelected([]);
  };

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to see the team's pipeline.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 p-4 md:block">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <div className="mt-6">
          <SideNav
            active="deals"
            sections={[
              {
                title: "Filter by stage",
                items: [
                  { label: "All stages", href: "#" },
                  ...STAGES.map((s) => ({ label: s, href: "#" })),
                ],
              },
            ]}
          />
          <div className="mt-4 flex flex-col gap-1">
            {[null, ...STAGES].map((s) => (
              <button
                key={s ?? "all"}
                onClick={() => setStage(s)}
                className={`rounded-md px-2 py-1.5 text-left text-sm ${
                  stage === s ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s ?? "All stages"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <p className="px-2 text-xs font-medium uppercase text-muted-foreground">Accounts</p>
          <div className="mt-2 flex flex-col gap-2">
            {accounts.isPending && <Skeleton className="h-16 rounded-md" />}
            {accounts.isError && (
              <p className="px-2 text-xs text-destructive">Couldn't load accounts.</p>
            )}
            {accounts.data?.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">No accounts yet.</p>
            )}
            {accounts.data?.map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-background px-2 py-1.5">
                <p className="text-sm font-medium">{a.name}</p>
                {a.website && <p className="truncate text-xs text-muted-foreground">{a.website}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <p className="px-2 text-xs font-medium uppercase text-muted-foreground">Playbook</p>
          <div className="mt-2 flex flex-col gap-2">
            {playbook.isPending && <Skeleton className="h-16 rounded-md" />}
            {playbook.isError && (
              <p className="px-2 text-xs text-destructive">Couldn't load the playbook.</p>
            )}
            {playbook.data?.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">Nothing published yet.</p>
            )}
            {playbook.data?.map((p) => (
              <div key={p.id} className="rounded-md border border-border bg-background px-2 py-1.5">
                <p className="text-sm font-medium">{p.title}</p>
                {p.body && <p className="line-clamp-2 text-xs text-muted-foreground">{p.body}</p>}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="text-sm text-muted-foreground">Everyone on the team reads and edits these together.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="motion-press">New record</Button>
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
                  <Button type="submit" className="motion-press" disabled={create.isPending}>
                    {create.isPending ? "Adding…" : "Add deal"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search deals"
            count={filtered.length}
            total={deals.data?.length ?? 0}
          />
          {stage && (
            <FilterBar
              filters={[{ key: "stage", label: `Stage: ${stage}` }]}
              onRemove={() => setStage(null)}
              onClear={() => setStage(null)}
            />
          )}
          {selected.length > 0 && (
            <BulkActions
              count={selected.length}
              onClear={() => setSelected([])}
              actions={[{ label: "Delete selected", onSelect: onBulkDelete, destructive: true }]}
            />
          )}
        </div>

        <div className="mt-4">
          {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the pipeline. Refresh and try again.</p>
          )}
          {deals.data?.length === 0 && (
            <Empty
              title="No deals yet"
              description="Add the first deal the team is working — it'll show up here for everyone."
            />
          )}
          {!!deals.data?.length && filtered.length === 0 && (
            <Empty title="Nothing matches" description="Try a different search or clear the stage filter." />
          )}
          {filtered.length > 0 && (
            <DataTable
              rowKey={(row) => row.id}
              rows={filtered}
              onRowClick={(row) => navigate({ to: "/record", search: { id: String(row.id) } })}
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "40px",
                  cell: (row) => (
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                        );
                      }}
                    />
                  ),
                },
                { key: "title", header: "Title", cell: (row) => row.title },
                { key: "value", header: "Value", cell: (row) => row.value ?? "—" },
                {
                  key: "stage",
                  header: "Stage",
                  cell: (row) => <StatusBadge state={stageState(row.stage)}>{row.stage ?? "New"}</StatusBadge>,
                },
              ]}
            />
          )}
        </div>
      </main>
    </div>
  );
}

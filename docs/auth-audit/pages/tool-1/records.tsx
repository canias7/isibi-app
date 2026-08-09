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
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
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
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc", limit: 8 });
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "asc", limit: 5 });
  const createDeal = useCreateRow<Deal>("deals");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
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

  const onSubmit = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
          <p className="mt-2 text-muted-foreground">
            The team's deals are private to signed-in members.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          sections={[
            { title: "Stage", items: STAGES.map((s) => ({ label: s, href: "#" })) },
          ]}
        />
        <div className="mt-8">
          <p className="text-xs font-medium uppercase text-muted-foreground">Filter by stage</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={`rounded-md border px-2 py-1 text-xs ${!stageFilter ? "border-primary bg-primary/10" : "border-border"}`}
              onClick={() => setStageFilter(null)}
            >
              All
            </button>
            {STAGES.map((s) => (
              <button
                key={s}
                className={`rounded-md border px-2 py-1 text-xs capitalize ${stageFilter === s ? "border-primary bg-primary/10" : "border-border"}`}
                onClick={() => setStageFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase text-muted-foreground">Accounts</p>
          {accounts.isPending && <Skeleton className="mt-2 h-24 rounded-md" />}
          {accounts.isError && (
            <p className="mt-2 text-xs text-destructive">Couldn't load accounts.</p>
          )}
          {accounts.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No accounts yet.</p>
          )}
          <ul className="mt-2 space-y-1.5 motion-stagger">
            {accounts.data?.map((a) => (
              <li key={a.id} className="text-xs">
                <p className="font-medium">{a.name}</p>
                {a.website && <p className="text-muted-foreground">{a.website}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase text-muted-foreground">Playbook</p>
          {playbook.isPending && <Skeleton className="mt-2 h-16 rounded-md" />}
          {playbook.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Nothing published yet.</p>
          )}
          <ul className="mt-2 space-y-1.5">
            {playbook.data?.map((p) => (
              <li key={p.id} className="text-xs font-medium">
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
            <p className="text-sm text-muted-foreground">Everything the team is working, in one place.</p>
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
                <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
        </div>

        <div className="mt-6">
          <TableSearch value={query} onChange={setQuery} placeholder="Search deals" count={filtered.length} total={deals.data?.length ?? 0} />
        </div>

        {stageFilter && (
          <div className="mt-3">
            <FilterBar
              filters={[{ key: "stage", label: `Stage: ${stageFilter}` }]}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            />
          </div>
        )}

        {selected.size > 0 && (
          <div className="mt-3">
            <BulkActions
              count={selected.size}
              onClear={() => setSelected(new Set())}
              actions={[
                {
                  label: "Clear selection",
                  onSelect: () => setSelected(new Set()),
                },
              ]}
            />
          </div>
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the pipeline. Refresh and try again.</p>
          )}
          {deals.data?.length === 0 && (
            <Empty
              title="No deals yet"
              description="Add the team's first deal to get the pipeline going."
            />
          )}
          {!!deals.data?.length && filtered.length === 0 && (
            <Empty title="No matches" description="Try a different search or clear the stage filter." />
          )}
          {!!filtered.length && (
            <DataTable
              rowKey={(d) => d.id}
              rows={filtered}
              onRowClick={(d) => navigate({ to: "/record", search: { id: String(d.id) } })}
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "32px",
                  cell: (d) => (
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(d.id);
                        else next.delete(d.id);
                        setSelected(next);
                      }}
                    />
                  ),
                },
                { key: "title", header: "Title", cell: (d) => d.title },
                { key: "value", header: "Value", cell: (d) => d.value ?? "—" },
                {
                  key: "stage",
                  header: "Stage",
                  cell: (d) => <StatusBadge state={stageState(d.stage)}>{d.stage ?? "new"}</StatusBadge>,
                },
              ]}
            />
          )}
        </div>
      </main>
    </div>
  );
}

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
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
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

function stageState(stage: string | null) {
  if (stage === "Won") return "success" as const;
  if (stage === "Lost") return "danger" as const;
  if (stage === "Negotiation" || stage === "Proposal") return "warning" as const;
  return "neutral" as const;
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function Records() {
  const member = useMember();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "asc" });
  const create = useCreateRow<Deal>("deals");
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
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

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
        <p className="mt-3 text-muted-foreground">
          The deals table is private to your team — sign in to open it.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active="deals"
          sections={[
            {
              title: "Filters",
              items: [
                { label: "All deals", href: "#" },
                ...STAGES.map((s) => ({ label: s, href: "#" })),
              ],
            },
          ]}
        />
        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stage
          </p>
          <div className="mt-2 grid gap-1">
            <button
              className={`rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${!stageFilter ? "bg-muted font-medium" : ""}`}
              onClick={() => setStageFilter(null)}
            >
              All stages
            </button>
            {STAGES.map((s) => (
              <button
                key={s}
                className={`rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${stageFilter === s ? "bg-muted font-medium" : ""}`}
                onClick={() => setStageFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Playbook
          </p>
          {playbook.isPending && <Skeleton className="mt-2 h-16" />}
          {playbook.isError && (
            <p className="mt-2 text-xs text-destructive">Couldn't load the playbook.</p>
          )}
          {playbook.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Nothing published yet.</p>
          )}
          <ul className="mt-2 space-y-2 motion-stagger">
            {playbook.data?.slice(0, 4).map((p) => (
              <li key={p.id} className="text-sm">
                <p className="font-medium">{p.title}</p>
                {p.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.body}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Accounts
          </p>
          {accounts.isPending && <Skeleton className="mt-2 h-16" />}
          {accounts.isError && (
            <p className="mt-2 text-xs text-destructive">Couldn't load accounts.</p>
          )}
          {accounts.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No accounts yet.</p>
          )}
          <ul className="mt-2 space-y-1 motion-stagger">
            {accounts.data?.slice(0, 6).map((a) => (
              <li key={a.id} className="text-sm text-muted-foreground">
                {a.name}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every deal the team is working, shared and editable by anyone on it.
            </p>
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
                  <Button type="submit" className="motion-press" disabled={create.isPending}>
                    {create.isPending ? "Adding…" : "Add deal"}
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
            count={filtered.length}
            total={deals.data?.length ?? 0}
          />
        </div>

        {stageFilter && (
          <FilterBar
            className="mt-4"
            filters={[{ key: "stage", label: `Stage: ${stageFilter}` }]}
            onRemove={() => setStageFilter(null)}
            onClear={() => setStageFilter(null)}
          />
        )}

        {selected.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              {selected.length} selected — bulk actions aren't wired to a write path for this
              table yet; open each record to edit it.
            </p>
          </div>
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
          )}
          {!deals.isPending && !deals.isError && filtered.length === 0 && (
            <Empty
              title={deals.data?.length ? "No deals match" : "No deals yet"}
              description={
                deals.data?.length
                  ? "Try clearing the search or the stage filter."
                  : "Add the team's first deal to get the pipeline moving."
              }
            />
          )}
          {!deals.isPending && !deals.isError && filtered.length > 0 && (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
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
        </div>
      </main>
    </div>
  );
}

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
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add an amount, even a rough one"),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
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
    const rows = deals.data ?? [];
    return rows.filter((d) => {
      const matchesQuery = query
        ? d.title.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesStage = stageFilter ? d.stage === stageFilter : true;
      return matchesQuery && matchesStage;
    });
  }, [deals.data, query, stageFilter]);

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to see the team's deals.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/40 p-6 md:flex md:flex-col md:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">Halyard</p>
          <nav className="mt-8 grid gap-1 text-sm">
            <Link
              to="/records"
              className="rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground"
            >
              Deals
            </Link>
          </nav>
          <div className="mt-8">
            <p className="px-3 text-xs font-medium uppercase text-muted-foreground">
              Stage
            </p>
            <div className="mt-2 grid gap-1">
              <button
                type="button"
                onClick={() => setStageFilter(null)}
                className={`rounded-md px-3 py-1.5 text-left text-sm ${
                  stageFilter === null ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                All stages
              </button>
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStageFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-left text-sm ${
                    stageFilter === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as {member.data.name || member.data.email}
        </p>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything the whole team is working, in one table.
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
                          <Input placeholder="e.g. Northwind — annual renewal" {...field} />
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
                          <Input placeholder="e.g. £12,000" {...field} />
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
            placeholder="Search deals…"
            count={filtered.length}
            total={deals.data?.length}
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
                {
                  label: "Clear selection",
                  onSelect: () => setSelected([]),
                },
              ]}
            />
          </div>
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-72 rounded-xl" />}

          {deals.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the team's deals. Refresh and try again.
            </p>
          )}

          {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
            <Empty
              title="No deals yet"
              description="Add the first deal your team is working and it'll show up here for everyone."
            />
          )}

          {!deals.isPending && !deals.isError && !!deals.data?.length && (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
              empty="No deals match your search."
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "2rem",
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
                  cell: (r) => (
                    <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>
                  ),
                },
              ]}
            />
          )}
        </div>
      </main>
    </div>
  );
}

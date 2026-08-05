import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { SideNav } from "@/components/ui/side-nav";
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

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!stage) return "neutral";
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
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

  const onCreate = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline");
        form.reset();
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Sign in to see the pipeline</CardTitle>
            <CardDescription>The team's deals live behind a sign-in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="motion-press">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active="deals"
          sections={[
            {
              title: "Pipeline",
              items: [
                { label: "Deals", href: "#/records" },
              ],
            },
            {
              title: "Filters",
              items: STAGES.map((s) => ({ label: s, href: "#/records" })),
            },
          ]}
        />
      </aside>

      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything the team is working, in one place.
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
                <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Ltd — annual contract" {...field} />
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
                              <SelectValue placeholder="Pick a stage" />
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
          <FilterBar
            filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
            onRemove={() => setStageFilter(null)}
            onClear={() => setStageFilter(null)}
          >
            <Select
              value={stageFilter ?? ""}
              onValueChange={(v) => setStageFilter(v === "" ? null : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar>
        </div>

        {selected.size > 0 && (
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
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the pipeline. Refresh and try again.
            </p>
          )}
          {!deals.isPending && !deals.isError && filtered.length === 0 && (
            <Empty
              title="No deals here"
              description="Nothing matches those filters yet — add a deal or clear the search."
            />
          )}
          {!deals.isPending && !deals.isError && filtered.length > 0 && (
            <DataTable
              rowKey={(d) => d.id}
              rows={filtered}
              onRowClick={(d) => navigate({ to: "/record", search: { id: String(d.id) } })}
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "2rem",
                  cell: (d) => (
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRow(d.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ),
                },
                { key: "title", header: "Deal", cell: (d) => d.title },
                { key: "value", header: "Value", cell: (d) => d.value ?? "—" },
                {
                  key: "stage",
                  header: "Stage",
                  cell: (d) => (
                    <StatusBadge state={stageState(d.stage)}>{d.stage ?? "New"}</StatusBadge>
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

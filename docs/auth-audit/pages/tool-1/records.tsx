import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useDeleteRow, type Row } from "@/lib/rows";
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

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
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
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const remove = useDeleteRow("deals");

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
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const onCreate = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset({ title: "", value: "", stage: "New" });
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onBulkDelete = () => {
    selected.forEach((id) => remove.mutate(id));
    toast.success(`Removed ${selected.length} deal${selected.length === 1 ? "" : "s"}`);
    setSelected([]);
  };

  if (!member.isPending && !member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The pipeline is private to your team. Sign in to see it.
            </p>
            <Button asChild className="mt-4">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <p className="mb-6 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          sections={[
            {
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/accounts" },
                { label: "Playbook", href: "/playbook" },
              ],
            },
          ]}
          active="/records"
        />
      </aside>

      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything the team is working, in one table.
            </p>
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
                <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-4">
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search deals"
            count={filtered.length}
            total={deals.data?.length ?? 0}
          />
        </div>

        <FilterBar
          className="mt-3"
          filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
          onRemove={() => setStageFilter(null)}
          onClear={() => setStageFilter(null)}
        >
          {STAGES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={stageFilter === s ? "default" : "outline"}
              onClick={() => setStageFilter(stageFilter === s ? null : s)}
            >
              {s}
            </Button>
          ))}
        </FilterBar>

        {selected.length > 0 && (
          <BulkActions
            count={selected.length}
            onClear={() => setSelected([])}
            actions={[{ label: "Delete", onSelect: onBulkDelete, destructive: true }]}
          />
        )}

        <div className="mt-4">
          {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
          )}
          {!deals.isPending && !deals.isError && filtered.length === 0 && (
            <Empty
              title="No deals here yet"
              description="Add the team's first deal to get the pipeline started."
            />
          )}
          {!deals.isPending && !deals.isError && filtered.length > 0 && (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "2rem",
                  cell: (r) => (
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                        )
                      }
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
      </main>
    </div>
  );
}

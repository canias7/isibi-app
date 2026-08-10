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
  useUpdateRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiating", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiating" || stage === "Proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "What's it worth"),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc", limit: 20 });
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "desc", limit: 10 });
  const create = useCreateRow<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });

  const filtered = useMemo(() => {
    const rows = deals.data ?? [];
    return rows.filter((d) => {
      if (stage && d.stage !== stage) return false;
      if (query && !d.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [deals.data, query, stage]);

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const bulkSetStage = (nextStage: string) => {
    selected.forEach((id) => {
      update.mutate(
        { id, stage: nextStage },
        {
          onError: (e) => toast.error(e.message),
        },
      );
    });
    toast.success(`Moved ${selected.size} deal${selected.size === 1 ? "" : "s"} to ${nextStage}`);
    setSelected(new Set());
  };

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in to see the pipeline</CardTitle>
            <CardDescription>The deals and accounts are only visible once you're in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate({ to: "/" })}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <Link to="/records" className="rounded-md bg-muted px-3 py-2 font-medium">
            Deals
          </Link>
        </nav>

        <p className="mt-8 text-xs font-medium uppercase text-muted-foreground">Stage</p>
        <div className="mt-2 flex flex-col gap-1">
          <button
            className={`rounded-md px-3 py-1.5 text-left text-sm ${!stage ? "bg-muted font-medium" : "text-muted-foreground"}`}
            onClick={() => setStage(null)}
          >
            All stages
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              className={`rounded-md px-3 py-1.5 text-left text-sm ${stage === s ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setStage(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mt-8 text-xs font-medium uppercase text-muted-foreground">Accounts</p>
        <div className="mt-2 space-y-2">
          {accounts.isPending && <Skeleton className="h-16 w-full" />}
          {accounts.isError && (
            <p className="text-xs text-destructive">Couldn't load accounts.</p>
          )}
          {accounts.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">No accounts yet.</p>
          )}
          {accounts.data?.slice(0, 6).map((a) => (
            <div key={a.id} className="text-sm">
              <p className="font-medium">{a.name}</p>
              {a.website && (
                <p className="truncate text-xs text-muted-foreground">{a.website}</p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs font-medium uppercase text-muted-foreground">Playbook</p>
        <div className="mt-2 space-y-2">
          {playbook.isPending && <Skeleton className="h-10 w-full" />}
          {playbook.isError && (
            <p className="text-xs text-destructive">Couldn't load the playbook.</p>
          )}
          {playbook.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing published yet.</p>
          )}
          {playbook.data?.slice(0, 4).map((p) => (
            <p key={p.id} className="text-xs text-muted-foreground">
              {p.title}
            </p>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything the team is working, shared across everyone signed in.
            </p>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="motion-press">New record</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>New deal</SheetTitle>
              </SheetHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="mt-6 grid gap-4 px-4">
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
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search deals"
            count={filtered.length}
            total={deals.data?.length}
          />
          {stage && (
            <FilterBar
              filters={[{ key: "stage", label: stage }]}
              onRemove={() => setStage(null)}
              onClear={() => setStage(null)}
            />
          )}
        </div>

        {selected.size > 0 && (
          <div className="mt-4">
            <BulkActions
              count={selected.size}
              onClear={() => setSelected(new Set())}
              actions={STAGES.map((s) => ({
                label: `Move to ${s}`,
                onSelect: () => bulkSetStage(s),
              }))}
            />
          </div>
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-96 w-full rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the team's deals. Refresh and try again.
            </p>
          )}
          {deals.data?.length === 0 && (
            <Empty
              title="No deals yet"
              description="Add the first deal your team is working and it'll show up here for everyone."
            />
          )}
          {!!deals.data?.length && filtered.length === 0 && (
            <Empty
              title="Nothing matches"
              description="Try a different search or clear the stage filter."
            />
          )}
          {!!filtered.length && (
            <DataTable
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "2rem",
                  cell: (row) => (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRow(row.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
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
              rows={filtered}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate({ to: "/record", search: { id: String(row.id) } })}
            />
          )}
        </div>
      </main>
    </div>
  );
}

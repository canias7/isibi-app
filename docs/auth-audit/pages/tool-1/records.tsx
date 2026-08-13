import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useLogout,
  useRows,
  useCreateRow,
  useUpdateRow,
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
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type PlaybookEntry = Row & { title: string; body: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function Records() {
  const member = useMember();
  const logout = useLogout();
  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<PlaybookEntry>("playbook", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");

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

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="mt-3 text-muted-foreground">
          The team's deals live behind sign-in. Head back to the door to sign in.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset();
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const bulkSetStage = (stage: string) => {
    selected.forEach((id) => {
      update.mutate(
        { id, stage },
        {
          onError: (e: Error) => toast.error(e.message),
        },
      );
    });
    toast.success(`Moved ${selected.length} deal${selected.length === 1 ? "" : "s"} to ${stage}`);
    setSelected([]);
  };

  const toggleSelect = (id: number) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-col border-r border-border bg-muted/30 p-6 md:flex">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active="deals"
          sections={[
            {
              title: "Stage",
              items: STAGES.map((s) => ({ label: s, href: "#" })),
            },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-1">
          <button
            className={`rounded-md px-2 py-1 text-xs ${stageFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => setStageFilter(null)}
          >
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              className={`rounded-md px-2 py-1 text-xs ${stageFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setStageFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">Accounts</h2>
          {accounts.isPending && <Skeleton className="mt-2 h-16 rounded-md" />}
          {accounts.isError && (
            <p className="mt-2 text-xs text-destructive">Couldn't load accounts.</p>
          )}
          {accounts.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No accounts yet.</p>
          )}
          <ul className="mt-2 space-y-1 motion-stagger">
            {accounts.data?.slice(0, 6).map((a) => (
              <li key={a.id} className="truncate text-xs text-muted-foreground">
                {a.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">Playbook</h2>
          {playbook.isPending && <Skeleton className="mt-2 h-16 rounded-md" />}
          {playbook.isError && (
            <p className="mt-2 text-xs text-destructive">Couldn't load the playbook.</p>
          )}
          {playbook.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Nothing published yet.</p>
          )}
          <ul className="mt-2 space-y-1">
            {playbook.data?.slice(0, 5).map((p) => (
              <li key={p.id} className="truncate text-xs text-muted-foreground">
                {p.title}
              </li>
            ))}
          </ul>
        </div>

        <Button variant="ghost" className="mt-auto" onClick={() => logout.mutate()}>
          Sign out
        </Button>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone on the team reads and moves the same rows.
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
                        <FormControl>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
                  <Button type="submit" disabled={create.isPending} className="motion-press">
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
          {stageFilter && (
            <FilterBar
              filters={[{ key: "stage", label: stageFilter }]}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            />
          )}
        </div>

        {selected.length > 0 && (
          <BulkActions
            count={selected.length}
            onClear={() => setSelected([])}
            actions={STAGES.map((s) => ({ label: `Move to ${s}`, onSelect: () => bulkSetStage(s) }))}
          />
        )}

        <div className="mt-4">
          {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
          )}
          {!deals.isPending && !deals.isError && filtered.length === 0 && (
            <Empty
              title="No deals here"
              description="Add the first deal for the team to start working it."
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
                  cell: (r) => (
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(r.id)}
                    />
                  ),
                  width: "2rem",
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

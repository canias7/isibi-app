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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { TagList } from "@/components/ui/tag-list";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type PlaybookEntry = Row & { title: string; body: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add an estimated value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Name it"),
  website: z.string().min(1, "Add a website"),
  notes: z.string().max(1000).optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<PlaybookEntry>("playbook", { order: "id", dir: "desc" });

  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
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

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the team's deals</h1>
        <p className="text-muted-foreground">
          The pipeline is private to your team. Sign in first.
        </p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-8 space-y-1 text-sm">
          <Link to="/records" className="block rounded-md bg-muted px-3 py-2 font-medium">
            Deals
          </Link>
        </nav>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage</p>
          <div className="mt-3">
            <TagList items={STAGES} active={stageFilter} onSelect={setStageFilter} />
          </div>
        </div>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Accounts
          </p>
          <div className="mt-3 space-y-2">
            {accounts.isPending && <Skeleton className="h-16 rounded-md" />}
            {accounts.isError && (
              <p className="text-xs text-destructive">Couldn't load accounts.</p>
            )}
            {accounts.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">No accounts yet.</p>
            )}
            {accounts.data?.slice(0, 6).map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-card p-2 text-xs">
                <p className="font-medium">{a.name}</p>
                {a.website && <p className="truncate text-muted-foreground">{a.website}</p>}
              </div>
            ))}
          </div>
          <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                Add account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New account</DialogTitle>
              </DialogHeader>
              <Form {...accountForm}>
                <form
                  onSubmit={accountForm.handleSubmit(onCreateAccount)}
                  className="grid gap-4"
                >
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
                          <Input {...field} />
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
                  <Button type="submit" disabled={createAccount.isPending}>
                    {createAccount.isPending ? "Adding…" : "Add account"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Playbook
          </p>
          <div className="mt-3 space-y-2">
            {playbook.isPending && <Skeleton className="h-16 rounded-md" />}
            {playbook.isError && (
              <p className="text-xs text-destructive">Couldn't load the playbook.</p>
            )}
            {playbook.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing published yet.</p>
            )}
            {playbook.data?.slice(0, 4).map((p) => (
              <div key={p.id} className="rounded-md border border-border bg-card p-2 text-xs">
                <p className="font-medium">{p.title}</p>
                {p.body && <p className="line-clamp-2 text-muted-foreground">{p.body}</p>}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
            <p className="text-sm text-muted-foreground">
              Everything the team is working, in one table.
            </p>
          </div>
          <Dialog open={dealOpen} onOpenChange={setDealOpen}>
            <DialogTrigger asChild>
              <Button className="motion-press">New record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New deal</DialogTitle>
              </DialogHeader>
              <Form {...dealForm}>
                <form onSubmit={dealForm.handleSubmit(onCreateDeal)} className="grid gap-4">
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
                        <FormLabel>Estimated value</FormLabel>
                        <FormControl>
                          <Input placeholder="£12,000" {...field} />
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
                  <Button type="submit" disabled={createDeal.isPending}>
                    {createDeal.isPending ? "Adding…" : "Add deal"}
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
          <div className="mt-3">
            <FilterBar
              filters={[{ key: "stage", label: `Stage: ${stageFilter}` }]}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            />
          </div>
        )}

        {selected.length > 0 && (
          <div className="mt-3">
            <BulkActions
              count={selected.length}
              onClear={() => setSelected([])}
              actions={[
                {
                  label: "Clear selection",
                  onClick: () => setSelected([]),
                },
              ]}
            />
          </div>
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-72 w-full rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the team's deals. Refresh and try again.
            </p>
          )}
          {deals.data?.length === 0 && (
            <Empty
              title="No deals yet"
              description="Add the first deal the team is working and it'll show up here for everyone."
            />
          )}
          {!deals.isPending && !deals.isError && (deals.data?.length ?? 0) > 0 && filtered.length === 0 && (
            <Empty title="No matches" description="Try a different search or clear the stage filter." />
          )}
          {filtered.length > 0 && (
            <DataTable
              data={filtered}
              getRowId={(d) => d.id}
              selected={selected}
              onSelectedChange={setSelected}
              onRowClick={(d) => navigate({ to: "/record", search: { id: d.id } })}
              columns={[
                { key: "title", header: "Deal", cell: (d) => d.title },
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

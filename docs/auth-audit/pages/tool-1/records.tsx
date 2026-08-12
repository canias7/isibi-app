import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  useMember,
  useRows,
  useCreateRow,
  useUpdateRow,
  type Row,
} from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { useLogin, useLogout } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
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

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const login = useLogin();

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">Halyard</h1>
          <LoginForm
            busy={login.isPending}
            error={login.error?.message}
            onSubmit={(v) => login.mutate(v, { onError: (e) => toast.error(e.message) })}
          />
        </div>
      </main>
    );
  }

  return <RecordsBoard />;
}

function RecordsBoard() {
  const navigate = useNavigate();
  const logout = useLogout();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const updateDeal = useUpdateRow<Deal>("deals");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
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

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const bulkSetStage = (stage: string) => {
    selected.forEach((id) => {
      updateDeal.mutate({ id, stage } as Partial<Deal> & { id: number });
    });
    toast.success(`Moved ${selected.size} deal${selected.size === 1 ? "" : "s"} to ${stage}`);
    setSelected(new Set());
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active="/records"
          sections={[
            {
              title: "Pipeline",
              items: [{ label: "Records", href: "/records" }],
            },
          ]}
        />
        <div className="mt-8">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Stage</p>
          <div className="flex flex-col gap-1">
            <button
              className={`rounded-md px-2 py-1.5 text-left text-sm motion-press ${!stageFilter ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent"}`}
              onClick={() => setStageFilter(null)}
            >
              All stages
            </button>
            {STAGES.map((s) => (
              <button
                key={s}
                className={`rounded-md px-2 py-1.5 text-left text-sm motion-press ${stageFilter === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent"}`}
                onClick={() => setStageFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Accounts</p>
          {accounts.isPending && <Skeleton className="h-20 rounded-md" />}
          {accounts.isError && (
            <p className="text-xs text-destructive">Couldn't load accounts.</p>
          )}
          {accounts.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">No accounts yet.</p>
          )}
          <ul className="space-y-1 motion-stagger">
            {accounts.data?.slice(0, 6).map((a) => (
              <li key={a.id} className="truncate text-sm text-muted-foreground">
                {a.name}
              </li>
            ))}
          </ul>
          <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                New account
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
                  <Button type="submit" disabled={createAccount.isPending} className="motion-press">
                    {createAccount.isPending ? "Adding…" : "Add account"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <Button variant="ghost" size="sm" className="mt-10 w-full" onClick={() => logout.mutate()}>
          Sign out
        </Button>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input placeholder="£4,500" {...field} />
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
                  <Button type="submit" disabled={createDeal.isPending} className="motion-press">
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
          {stageFilter && (
            <FilterBar
              filters={[{ key: "stage", label: stageFilter }]}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            />
          )}
        </div>

        {selected.size > 0 && (
          <div className="mt-4">
            <BulkActions
              count={selected.size}
              onClear={() => setSelected(new Set())}
              actions={STAGES.map((s) => ({ label: `Move to ${s}`, onSelect: () => bulkSetStage(s) }))}
            />
          </div>
        )}

        <div className="mt-6">
          {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the team's deals. Refresh and try again.</p>
          )}
          {deals.data?.length === 0 && (
            <Empty
              title="No deals yet"
              description="Add the team's first deal to get the pipeline started."
            />
          )}
          {!!deals.data?.length && filtered.length === 0 && (
            <Empty title="No matches" description="Try a different search or clear the filter." />
          )}
          {filtered.length > 0 && (
            <DataTable
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "40px",
                  cell: (row) => (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggle(row.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ),
                },
                { key: "title", header: "Deal", cell: (row) => row.title },
                { key: "value", header: "Value", cell: (row) => row.value ?? "—" },
                {
                  key: "stage",
                  header: "Stage",
                  cell: (row) => (
                    <StatusBadge state={stageState(row.stage)}>{row.stage ?? "New"}</StatusBadge>
                  ),
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

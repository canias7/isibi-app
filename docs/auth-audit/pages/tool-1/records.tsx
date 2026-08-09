import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { SideNav } from "@/components/ui/side-nav";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResultCount } from "@/components/ui/result-count";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/ui/login-form";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLogin } from "@/lib/rows";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Proposal" || stage === "Negotiation") return "warning";
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

  if (member.isPending) {
    return <div className="p-10 text-sm text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return <SignInPrompt />;
  }

  return <Workspace />;
}

function SignInPrompt() {
  const login = useLogin();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center p-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to see the team's deals.</p>
        <LoginForm
          busy={login.isPending}
          onSubmit={(v) =>
            login.mutate(v, {
              onSuccess: () => navigate({ to: "/records" }),
              onError: (e) => toast.error(e.message),
            })
          }
        />
      </div>
    </div>
  );
}

function Workspace() {
  const deals = useRows<Deal>("deals");
  const accounts = useRows<Account>("accounts");
  const playbook = useRows<Playbook>("playbook");
  const create = useCreateRow<Deal>("deals");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
  });

  const filtered = useMemo(() => {
    const rows = deals.data ?? [];
    return rows.filter((d) => {
      if (stageFilter && d.stage !== stageFilter) return false;
      if (query && !d.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [deals.data, stageFilter, query]);

  const grouped = useMemo(() => {
    return STAGES.map((s) => ({ stage: s, count: (deals.data ?? []).filter((d) => d.stage === s).length })).filter(
      (g) => g.count > 0,
    );
  }, [deals.data]);

  const onSubmit = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added.");
        form.reset();
        setDialogOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          sections={[
            {
              title: "Stage",
              items: grouped.map((g) => ({ label: `${g.stage} (${g.count})`, href: "#" })),
            },
          ]}
        />
        <div className="mt-6 space-y-1">
          <Button
            variant={stageFilter === null ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setStageFilter(null)}
          >
            All stages
          </Button>
          {STAGES.map((s) => (
            <Button
              key={s}
              variant={stageFilter === s ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setStageFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="mt-8">
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Playbook
          </p>
          {playbook.isPending && <Skeleton className="mt-2 h-16 rounded-md" />}
          {playbook.isError && (
            <p className="mt-2 px-2 text-xs text-destructive">Couldn't load the playbook.</p>
          )}
          {playbook.data?.length === 0 && (
            <p className="mt-2 px-2 text-xs text-muted-foreground">Nothing published yet.</p>
          )}
          <ul className="mt-2 space-y-2 motion-stagger">
            {playbook.data?.slice(0, 4).map((p) => (
              <li key={p.id} className="rounded-md px-2 py-1 text-xs text-muted-foreground">
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <div className="border-b border-border p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
              <p className="text-sm text-muted-foreground">Shared across the whole team — anyone can open and edit.</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>New deal</Button>
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
                          <FormControl>
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                    <Button type="submit" className="motion-press" disabled={create.isPending}>
                      {create.isPending ? "Adding…" : "Add deal"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <TableSearch
              value={query}
              onChange={setQuery}
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
            <div className="mt-3">
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
        </div>

        <div className="p-6">
          {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
          {deals.isError && (
            <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
          )}
          {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
            <Empty title="No deals yet" description="Add the first one the team is working." />
          )}
          {!deals.isPending && !deals.isError && !!deals.data?.length && (
            <>
              <ResultCount total={filtered.length} noun="deal" filtered={!!query || !!stageFilter} />
              <DataTable
                className="mt-3"
                rowKey={(r) => r.id}
                rows={filtered}
                onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                columns={[
                  {
                    key: "select",
                    header: "",
                    width: "2.5rem",
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
                  { key: "title", header: "Title", cell: (r) => r.title },
                  { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
                  {
                    key: "stage",
                    header: "Stage",
                    cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>,
                  },
                ]}
              />
            </>
          )}
        </div>

        <div className="border-t border-border p-6">
          <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted-foreground">Shared by the whole team — anyone signed in can add one.</p>
          <AccountsPanel accounts={accounts} />
        </div>
      </div>
    </div>
  );
}

const accountSchema = z.object({
  name: z.string().min(2, "Name it"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function AccountsPanel({ accounts }: { accounts: ReturnType<typeof useRows<Account>> }) {
  const create = useCreateRow<Account>("accounts");
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const onSubmit = (values: AccountForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Account added.");
        form.reset();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {accounts.isPending && <Skeleton className="h-40 rounded-xl" />}
        {accounts.isError && (
          <p className="text-sm text-destructive">Couldn't load accounts.</p>
        )}
        {accounts.data?.length === 0 && (
          <Empty title="No accounts yet" description="Add the first one the team is selling into." />
        )}
        {!!accounts.data?.length && (
          <DataTable
            rowKey={(r) => r.id}
            rows={accounts.data}
            columns={[
              { key: "name", header: "Name", cell: (r) => r.name },
              { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
              { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
            ]}
          />
        )}
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
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
          <Button type="submit" className="motion-press" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add account"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

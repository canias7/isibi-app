import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { ResultCount } from "@/components/ui/result-count";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoginForm } from "@/components/ui/login-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogin } from "@/lib/rows";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give it a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Name it"),
  website: z.string().optional(),
  notes: z.string().optional(),
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
  const login = useLogin();
  const navigate = useNavigate();
  const [view, setView] = useState<"deals" | "accounts" | "playbook">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<Row & { title: string; body: string | null }>("playbook", {
    order: "id",
    dir: "desc",
  });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "lead" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-md px-6 py-24">
        <Skeleton className="h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in to Halyard</h1>
          <LoginForm
            busy={login.isPending}
            error={login.error?.message ?? null}
            onSubmit={(v) =>
              login.mutate(v, {
                onError: (e: Error) => toast.error(e.message),
              })
            }
          />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <div className="mt-6">
          <SideNav
            active={view}
            sections={[
              {
                title: "Views",
                items: [
                  { label: "Deals", href: "#deals" },
                  { label: "Accounts", href: "#accounts" },
                  { label: "Playbook", href: "#playbook" },
                ],
              },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-col gap-1 px-2">
          <button
            className={`rounded-md px-2 py-1.5 text-left text-sm ${view === "deals" ? "bg-accent font-medium" : "text-muted-foreground"}`}
            onClick={() => setView("deals")}
          >
            Deals
          </button>
          <button
            className={`rounded-md px-2 py-1.5 text-left text-sm ${view === "accounts" ? "bg-accent font-medium" : "text-muted-foreground"}`}
            onClick={() => setView("accounts")}
          >
            Accounts
          </button>
          <button
            className={`rounded-md px-2 py-1.5 text-left text-sm ${view === "playbook" ? "bg-accent font-medium" : "text-muted-foreground"}`}
            onClick={() => setView("playbook")}
          >
            Playbook
          </button>
        </div>
        {view === "deals" && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="px-2 text-xs font-medium uppercase text-muted-foreground">Stage</p>
            <div className="mt-2 flex flex-col gap-1 px-2">
              <button
                className={`rounded-md px-2 py-1 text-left text-sm ${!stageFilter ? "font-medium" : "text-muted-foreground"}`}
                onClick={() => setStageFilter(null)}
              >
                All stages
              </button>
              {STAGES.map((s) => (
                <button
                  key={s}
                  className={`rounded-md px-2 py-1 text-left text-sm capitalize ${stageFilter === s ? "font-medium" : "text-muted-foreground"}`}
                  onClick={() => setStageFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-x-hidden p-8">
        {view === "deals" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Everything the team is working, shared across everyone signed in.
                </p>
              </div>
              <Dialog open={dealOpen} onOpenChange={setDealOpen}>
                <DialogTrigger asChild>
                  <Button>New record</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New deal</DialogTitle>
                  </DialogHeader>
                  <Form {...dealForm}>
                    <form
                      className="grid gap-4"
                      onSubmit={dealForm.handleSubmit((v) =>
                        createDeal.mutate(v, {
                          onSuccess: () => {
                            toast.success("Deal added");
                            dealForm.reset();
                            setDealOpen(false);
                          },
                          onError: (e: Error) => toast.error(e.message),
                        }),
                      )}
                    >
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
                                  <SelectValue placeholder="Pick a stage" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {STAGES.map((s) => (
                                  <SelectItem key={s} value={s} className="capitalize">
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
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
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
                      label: "Mark won",
                      onSelect: () => {
                        toast.message("Bulk stage change isn't wired to a bulk endpoint yet — open each record to update it.");
                        setSelected([]);
                      },
                    },
                  ]}
                />
              </div>
            )}

            <div className="mt-4">
              <ResultCount total={filteredDeals.length} noun="deal" filtered={!!stageFilter || !!query} />
            </div>

            <div className="mt-3">
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {deals.data?.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the team's first deal to get the pipeline going."
                />
              )}
              {!deals.isPending && !deals.isError && (deals.data?.length ?? 0) > 0 && (
                <DataTable<Deal>
                  rows={filteredDeals}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                  columns={[
                    { key: "title", header: "Title", cell: (r) => r.title },
                    { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
                    {
                      key: "stage",
                      header: "Stage",
                      cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "lead"}</StatusBadge>,
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}

        {view === "accounts" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shared across the team — anyone signed in can read and add one.
                </p>
              </div>
              <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                <DialogTrigger asChild>
                  <Button>New record</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New account</DialogTitle>
                  </DialogHeader>
                  <Form {...accountForm}>
                    <form
                      className="grid gap-4"
                      onSubmit={accountForm.handleSubmit((v) =>
                        createAccount.mutate(v, {
                          onSuccess: () => {
                            toast.success("Account added");
                            accountForm.reset();
                            setAccountOpen(false);
                          },
                          onError: (e: Error) => toast.error(e.message),
                        }),
                      )}
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
                              <Input placeholder="https://…" {...field} />
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

            <div className="mt-6">
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
              )}
              {accounts.data?.length === 0 && (
                <Empty title="No accounts yet" description="Add the first account the team is working with." />
              )}
              {!accounts.isPending && !accounts.isError && (accounts.data?.length ?? 0) > 0 && (
                <DataTable<Account>
                  rows={accounts.data ?? []}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "name", header: "Account", cell: (r) => r.name },
                    { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                  ]}
                />
              )}
            </div>
          </>
        )}

        {view === "playbook" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Maintained by the business — read here, not edited.
            </p>
            <div className="mt-6">
              {playbook.isPending && <Skeleton className="h-64 rounded-xl" />}
              {playbook.isError && (
                <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
              )}
              {playbook.data?.length === 0 && (
                <Empty title="Nothing here yet" description="The team hasn't published a playbook entry yet." />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {playbook.data?.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-card p-4">
                    <h2 className="font-medium">{p.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

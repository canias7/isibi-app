import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useLogin,
  useSignup,
  useRows,
  useCreateRow,
  type Row,
} from "@/lib/rows";
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
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add an estimated value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().min(1, "Add a website"),
  notes: z.string().max(1000).optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(8, "At least 8 characters"),
});
type Credentials = z.infer<typeof credentials>;

function Records() {
  const member = useMember();

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return <SignInPrompt />;
  }

  return <Workspace />;
}

function SignInPrompt() {
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const submit = (action: typeof login, values: Credentials) => {
    action.mutate(values, {
      onSuccess: () => {
        form.reset();
        navigate({ to: "/records" });
      },
      onError: () => toast.error("That email and password didn't match."),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Halyard</CardTitle>
          <CardDescription>The team's deals live behind a sign-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit((v) => submit(login, v))}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3">
                <Button type="submit" className="motion-press" disabled={login.isPending}>
                  {login.isPending ? "Signing in…" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={signup.isPending}
                  onClick={form.handleSubmit((v) => submit(signup, v))}
                >
                  Create an account
                </Button>
              </div>
            </form>
          </Form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link className="underline underline-offset-4" to="/">Back to the front door</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Workspace() {
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [rail, setRail] = useState<"deals" | "accounts">("deals");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filteredDeals = useMemo(() => {
    const rows = deals.data ?? [];
    return rows.filter((d) => {
      if (stageFilter && d.stage !== stageFilter) return false;
      if (query && !d.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [deals.data, query, stageFilter]);

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline.");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added.");
        accountForm.reset();
        setAccountOpen(false);
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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-8 grid gap-1">
          <button
            className={`rounded-md px-3 py-2 text-left text-sm ${rail === "deals" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => setRail("deals")}
          >
            Deals
          </button>
          <button
            className={`rounded-md px-3 py-2 text-left text-sm ${rail === "accounts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => setRail("accounts")}
          >
            Accounts
          </button>
          <Link to="/" className="mt-6 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
            Sign out
          </Link>
        </nav>
      </aside>

      <main className="flex-1 overflow-x-hidden p-8">
        {rail === "deals" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Everything the team is working, in one shared list.
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
                    <form className="grid gap-4" onSubmit={dealForm.handleSubmit(onCreateDeal)}>
                      <FormField
                        control={dealForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Ltd — annual licence" {...field} />
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
                            <FormControl>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
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
                      <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                        {createDeal.isPending ? "Adding…" : "Add deal"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TableSearch value={query} onChange={setQuery} placeholder="Search deals" count={filteredDeals.length} total={deals.data?.length ?? 0} />
              <FilterBar
                filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
                onRemove={() => setStageFilter(null)}
                onClear={() => setStageFilter(null)}
              >
                {STAGES.map((s) => (
                  <button
                    key={s}
                    className={`rounded-full border px-3 py-1 text-xs ${stageFilter === s ? "border-primary bg-primary/10" : "border-border"}`}
                    onClick={() => setStageFilter(stageFilter === s ? null : s)}
                  >
                    {s}
                  </button>
                ))}
              </FilterBar>
            </div>

            {selected.size > 0 && (
              <div className="mt-4">
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
              </div>
            )}

            <div className="mt-6">
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && deals.data?.length === 0 && (
                <Empty title="No deals yet" description="Add the first deal the team is working." />
              )}
              {!deals.isPending && !deals.isError && !!deals.data?.length && (
                <DataTable<Deal>
                  rowKey={(row) => row.id}
                  onRowClick={(row) => navigate({ to: "/record", search: { id: String(row.id) } })}
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
                    { key: "title", header: "Deal", cell: (row) => row.title },
                    { key: "value", header: "Value", cell: (row) => row.value ?? "—" },
                    {
                      key: "stage",
                      header: "Stage",
                      cell: (row) => <StatusBadge state={stageState(row.stage)}>{row.stage ?? "new"}</StatusBadge>,
                    },
                  ]}
                  rows={filteredDeals}
                  empty="No deals match those filters"
                />
              )}
            </div>
          </>
        )}

        {rail === "accounts" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  The shared list — anyone can add or read one.
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
                    <form className="grid gap-4" onSubmit={accountForm.handleSubmit(onCreateAccount)}>
                      <FormField
                        control={accountForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Ltd" {...field} />
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
                              <Input placeholder="acme.com" {...field} />
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
                              <Input placeholder="Met at the trade show, keen on the annual plan" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="motion-press" disabled={createAccount.isPending}>
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
                <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
              )}
              {!accounts.isPending && !accounts.isError && accounts.data?.length === 0 && (
                <Empty title="No accounts yet" description="Add the first account the team is talking to." />
              )}
              {!accounts.isPending && !accounts.isError && !!accounts.data?.length && (
                <DataTable<Account>
                  rowKey={(row) => row.id}
                  columns={[
                    { key: "name", header: "Account", cell: (row) => row.name },
                    { key: "website", header: "Website", cell: (row) => row.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (row) => row.notes ?? "—" },
                  ]}
                  rows={accounts.data}
                  empty="No accounts yet"
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

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

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
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

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const filteredAccounts = useMemo(() => {
    let rows = accounts.data ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((a) => a.name.toLowerCase().includes(q));
    }
    return rows;
  }, [accounts.data, query]);

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(
      { title: values.title, value: values.value || null, stage: values.stage },
      {
        onSuccess: () => {
          toast.success("Deal added");
          dealForm.reset();
          setDealOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(
      { name: values.name, website: values.website || null, notes: values.notes || null },
      {
        onSuccess: () => {
          toast.success("Account added");
          accountForm.reset();
          setAccountOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (member.isPending) {
    return (
      <main className="p-10">
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="grid min-h-screen place-items-center p-10">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>The pipeline is only visible to signed-in team members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/30 p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <button
            className={`rounded-md px-3 py-2 text-left ${view === "deals" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => {
              setView("deals");
              setStageFilter(null);
              setSelected([]);
            }}
          >
            Deals
          </button>
          <button
            className={`rounded-md px-3 py-2 text-left ${view === "accounts" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => {
              setView("accounts");
              setSelected([]);
            }}
          >
            Accounts
          </button>
        </nav>
        {view === "deals" && (
          <div className="mt-8">
            <p className="px-3 text-xs font-medium uppercase text-muted-foreground">Stage</p>
            <div className="mt-2 flex flex-col gap-1">
              {STAGES.map((s) => (
                <button
                  key={s}
                  className={`rounded-md px-3 py-1.5 text-left text-sm capitalize ${stageFilter === s ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
                  onClick={() => setStageFilter(stageFilter === s ? null : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "deals" ? "The team's deals" : "Accounts"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {view === "deals"
                ? "Everything the team is working, shared across the whole team."
                : "Every account the team knows, shared and editable by anyone signed in."}
            </p>
          </div>

          {view === "deals" ? (
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
                              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm capitalize"
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
          ) : (
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button className="motion-press">New record</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New account</DialogTitle>
                </DialogHeader>
                <Form {...accountForm}>
                  <form onSubmit={accountForm.handleSubmit(onCreateAccount)} className="grid gap-4">
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
                            <Input placeholder="https://" {...field} />
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
                    <Button type="submit" className="motion-press" disabled={createAccount.isPending}>
                      {createAccount.isPending ? "Adding…" : "Add account"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder={view === "deals" ? "Search deals" : "Search accounts"}
            count={view === "deals" ? filteredDeals.length : filteredAccounts.length}
            total={view === "deals" ? deals.data?.length : accounts.data?.length}
          />
          {view === "deals" && stageFilter && (
            <FilterBar
              filters={[{ key: "stage", label: `Stage: ${stageFilter}` }]}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            />
          )}
        </div>

        {view === "deals" && selected.length > 0 && (
          <div className="mt-4">
            <BulkActions
              count={selected.length}
              onClear={() => setSelected([])}
              actions={[{ label: "Clear selection", onClick: () => setSelected([]) }]}
            />
          </div>
        )}

        <div className="mt-6">
          {view === "deals" ? (
            <>
              {deals.isPending && <Skeleton className="h-64 w-full rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load the team's deals. Refresh and try again.
                </p>
              )}
              {deals.data?.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the team's first deal to start the pipeline."
                />
              )}
              {!!deals.data?.length && filteredDeals.length === 0 && (
                <Empty title="No matches" description="Try a different search or clear the filter." />
              )}
              {filteredDeals.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Title</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeals.map((d) => (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer"
                        onClick={() => navigate({ to: "/record", search: { id: d.id, type: "deal" } })}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(d.id)}
                            onCheckedChange={() => toggleSelected(d.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{d.title}</TableCell>
                        <TableCell>{d.value ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge state={stageState(d.stage)}>{d.stage ?? "new"}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : (
            <>
              {accounts.isPending && <Skeleton className="h-64 w-full rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load accounts. Refresh and try again.
                </p>
              )}
              {accounts.data?.length === 0 && (
                <Empty
                  title="No accounts yet"
                  description="Add the first account the team is talking to."
                />
              )}
              {!!accounts.data?.length && filteredAccounts.length === 0 && (
                <Empty title="No matches" description="Try a different search." />
              )}
              {filteredAccounts.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((a) => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => navigate({ to: "/record", search: { id: a.id, type: "account" } })}
                      >
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.website ?? "—"}</TableCell>
                        <TableCell className="max-w-xs truncate">{a.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <h2 className="text-sm font-medium">The playbook</h2>
          <p className="text-xs text-muted-foreground">
            Guidance the business keeps up to date — read here, maintained elsewhere.
          </p>
          <Link to="/record" search={{ id: "", type: "deal" }} className="sr-only">
            placeholder
          </Link>
        </div>
      </main>
    </div>
  );
}

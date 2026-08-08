import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useLogout, type Row } from "@/lib/rows";
import { SideNav } from "@/components/ui/side-nav";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResultCount } from "@/components/ui/result-count";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function Records() {
  const member = useMember();
  const logout = useLogout();
  const navigate = useNavigate();
  const [section, setSection] = useState<"deals" | "accounts" | "playbook">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<PlaybookEntry>("playbook", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
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

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="max-w-sm text-muted-foreground">
          Sign in to see the team's pipeline, the shared accounts and the playbook.
        </p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

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

  return (
    <div className="flex min-h-screen">
      <div className="w-64 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={section}
          sections={[
            {
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
                { label: "Playbook", href: "#playbook" },
              ],
            },
          ]}
        />
        <div className="mt-4 flex flex-col gap-1 px-2">
          <button
            onClick={() => setSection("deals")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${section === "deals" ? "bg-accent font-medium" : "text-muted-foreground"}`}
          >
            Deals
          </button>
          <button
            onClick={() => setSection("accounts")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${section === "accounts" ? "bg-accent font-medium" : "text-muted-foreground"}`}
          >
            Accounts
          </button>
          <button
            onClick={() => setSection("playbook")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${section === "playbook" ? "bg-accent font-medium" : "text-muted-foreground"}`}
          >
            Playbook
          </button>
        </div>
        <div className="mt-8 border-t border-border pt-4 px-2">
          <p className="truncate text-xs text-muted-foreground">{member.data.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => logout.mutate()}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden p-8">
        {section === "deals" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">Our deals</h1>
              <Dialog open={dealOpen} onOpenChange={setDealOpen}>
                <DialogTrigger asChild>
                  <Button>New record</Button>
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
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
              />
            </div>

            <FilterBar
              className="mt-3"
              filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            >
              <Select value={stageFilter ?? ""} onValueChange={(v) => setStageFilter(v || null)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Stage" />
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

            {selected.length > 0 && (
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
            )}

            <ResultCount className="mt-4" total={filteredDeals.length} noun="deal" filtered={!!stageFilter || !!query} />

            {deals.isPending && <Skeleton className="mt-4 h-64 rounded-xl" />}
            {deals.isError && (
              <p className="mt-4 text-sm text-destructive">Couldn't load the team's deals. Refresh and try again.</p>
            )}
            {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
              <Empty
                className="mt-4"
                title="No deals yet"
                description="Add the team's first deal to start the pipeline."
              />
            )}
            {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
              <DataTable
                className="mt-4"
                rows={filteredDeals}
                rowKey={(d) => d.id}
                onRowClick={(d) => navigate({ to: "/record", search: { id: String(d.id) } })}
                columns={[
                  {
                    key: "select",
                    header: "",
                    width: "32px",
                    cell: (d) => (
                      <Checkbox
                        checked={selected.includes(Number(d.id))}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(v) =>
                          setSelected((prev) =>
                            v ? [...prev, Number(d.id)] : prev.filter((id) => id !== Number(d.id)),
                          )
                        }
                      />
                    ),
                  },
                  { key: "title", header: "Title", cell: (d) => d.title },
                  { key: "value", header: "Value", cell: (d) => d.value ?? "—" },
                  {
                    key: "stage",
                    header: "Stage",
                    cell: (d) => <StatusBadge state={stageState(d.stage)}>{d.stage ?? "New"}</StatusBadge>,
                  },
                ]}
              />
            )}
          </>
        )}

        {section === "accounts" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
              <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                <DialogTrigger asChild>
                  <Button>New record</Button>
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
                      <Button type="submit" disabled={createAccount.isPending}>
                        {createAccount.isPending ? "Adding…" : "Add account"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {accounts.isPending && <Skeleton className="mt-6 h-64 rounded-xl" />}
            {accounts.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
            )}
            {accounts.data?.length === 0 && (
              <Empty className="mt-6" title="No accounts yet" description="Add the first account the team is working with." />
            )}
            {!!accounts.data?.length && (
              <DataTable
                className="mt-6"
                rows={accounts.data}
                rowKey={(a) => a.id}
                columns={[
                  { key: "name", header: "Name", cell: (a) => a.name },
                  {
                    key: "website",
                    header: "Website",
                    cell: (a) =>
                      a.website ? (
                        <a href={a.website} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                          {a.website}
                        </a>
                      ) : (
                        "—"
                      ),
                  },
                  { key: "notes", header: "Notes", cell: (a) => a.notes ?? "—" },
                ]}
              />
            )}
          </>
        )}

        {section === "playbook" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">Kept current by the business — read here, not edited.</p>

            {playbook.isPending && <Skeleton className="mt-6 h-64 rounded-xl" />}
            {playbook.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
            )}
            {playbook.data?.length === 0 && (
              <Empty className="mt-6" title="Nothing here yet" description="The playbook hasn't been published." />
            )}
            {!!playbook.data?.length && (
              <ul className="mt-6 space-y-4 motion-stagger">
                {playbook.data.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-4">
                    <h2 className="font-medium">{p.title}</h2>
                    {p.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{p.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

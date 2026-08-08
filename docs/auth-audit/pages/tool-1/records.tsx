import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  useMember,
  useRows,
  useCreateRow,
  useUpdateRow,
  type Row,
} from "@/lib/rows";
import { SideNav } from "@/components/ui/side-nav";
import { DataTable, type Column } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
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
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["new", "qualified", "proposal", "won", "lost"];

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
  const [section, setSection] = useState<"deals" | "accounts" | "playbook">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const updateDeal = useUpdateRow<Deal>("deals");

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

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10">
        <Card className="max-w-sm text-center">
          <CardHeader>
            <CardTitle>Sign in to see the team's deals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The pipeline is only visible to signed-in team members.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dealColumns: Column<Deal>[] = [
    { key: "title", header: "Deal" },
    { key: "value", header: "Value", cell: (d) => d.value ?? "—" },
    {
      key: "stage",
      header: "Stage",
      cell: (d) => (
        <StatusBadge
          state={
            d.stage === "won"
              ? "success"
              : d.stage === "lost"
                ? "danger"
                : d.stage === "proposal"
                  ? "warning"
                  : "neutral"
          }
        >
          {d.stage ?? "new"}
        </StatusBadge>
      ),
    },
  ];

  const accountColumns: Column<Account>[] = [
    { key: "name", header: "Account" },
    { key: "website", header: "Website", cell: (a) => a.website ?? "—" },
    { key: "notes", header: "Notes", cell: (a) => a.notes ?? "—" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
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
        <div className="mt-4 flex flex-col gap-1">
          <Button variant={section === "deals" ? "default" : "ghost"} onClick={() => setSection("deals")}>
            Deals
          </Button>
          <Button variant={section === "accounts" ? "default" : "ghost"} onClick={() => setSection("accounts")}>
            Accounts
          </Button>
          <Button variant={section === "playbook" ? "default" : "ghost"} onClick={() => setSection("playbook")}>
            Playbook
          </Button>
        </div>

        {section === "deals" && (
          <FormSection title="New deal" className="mt-8">
            <Form {...dealForm}>
              <form
                className="grid gap-3"
                onSubmit={dealForm.handleSubmit((v) => {
                  createDeal.mutate(v, {
                    onSuccess: () => {
                      toast.success("Deal added");
                      dealForm.reset();
                    },
                    onError: (e) => toast.error(e.message),
                  });
                })}
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
                <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                  {createDeal.isPending ? "Adding…" : "Add deal"}
                </Button>
              </form>
            </Form>
          </FormSection>
        )}

        {section === "accounts" && (
          <FormSection title="New account" className="mt-8">
            <Form {...accountForm}>
              <form
                className="grid gap-3"
                onSubmit={accountForm.handleSubmit((v) => {
                  createAccount.mutate(v, {
                    onSuccess: () => {
                      toast.success("Account added");
                      accountForm.reset();
                    },
                    onError: (e) => toast.error(e.message),
                  });
                })}
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
                <Button type="submit" className="motion-press" disabled={createAccount.isPending}>
                  {createAccount.isPending ? "Adding…" : "Add account"}
                </Button>
              </form>
            </Form>
          </FormSection>
        )}
      </aside>

      <main className="flex-1 p-8">
        {section === "deals" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone on the team reads and edits these — add one, or move a stage.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search deals"
                count={filteredDeals.length}
                total={deals.data?.length}
              />
            </div>

            <FilterBar
              className="mt-4"
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
                actions={STAGES.map((s) => ({
                  label: `Move to ${s}`,
                  onSelect: () => {
                    selected.forEach((id) => {
                      updateDeal.mutate(
                        { id, values: { stage: s } },
                        { onError: (e) => toast.error(e.message) },
                      );
                    });
                    toast.success(`Moved ${selected.length} deal(s) to ${s}`);
                    setSelected([]);
                  },
                }))}
              />
            )}

            <div className="mt-4">
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {deals.data?.length === 0 && (
                <Empty title="No deals yet" description="Add the team's first deal from the panel on the left." />
              )}
              {!!deals.data?.length && (
                <DataTable
                  columns={dealColumns}
                  rows={filteredDeals}
                  rowKey={(d) => d.id}
                  onRowClick={(d) => navigate({ to: "/record", search: { id: String(d.id) } })}
                  empty="No deals match those filters."
                />
              )}
              {!!filteredDeals.length && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selected.length === filteredDeals.length}
                    onChange={(e) =>
                      setSelected(e.target.checked ? filteredDeals.map((d) => d.id) : [])
                    }
                  />
                  Select all shown
                </div>
              )}
            </div>
          </>
        )}

        {section === "accounts" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared across the whole team — anyone signed in can add one.
            </p>
            <div className="mt-6">
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
              )}
              {accounts.data?.length === 0 && (
                <Empty title="No accounts yet" description="Add the first account from the panel on the left." />
              )}
              {!!accounts.data?.length && (
                <DataTable columns={accountColumns} rows={accounts.data} rowKey={(a) => a.id} />
              )}
            </div>
          </>
        )}

        {section === "playbook" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Maintained by the business — read here, edited elsewhere.
            </p>
            <div className="mt-6 space-y-4">
              {playbook.isPending && <Skeleton className="h-40 rounded-xl" />}
              {playbook.isError && (
                <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
              )}
              {playbook.data?.length === 0 && (
                <Empty title="Nothing here yet" description="The team's playbook entries will appear here." />
              )}
              {playbook.data?.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

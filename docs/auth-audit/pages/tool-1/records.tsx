import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useRows,
  useCreateRow,
  useUpdateRow,
  useDeleteRow,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BulkActions } from "@/components/ui/bulk-actions";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { SideNav } from "@/components/ui/side-nav";
import { SiteChrome } from "@/components/ui/site-chrome";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSearch } from "@/components/ui/table-search";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

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

const CHROME = {
  name: "Halyard",
  tagline: "The team's shared pipeline",
  links: [
    { label: "Records", href: "#/records" },
  ],
  action: { label: "New record", href: "#/records" },
};

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [section, setSection] = useState<"deals" | "accounts" | "playbook">("deals");

  useEffect(() => {
    if (!member.isPending && !member.data) {
      navigate({ to: "/" });
    }
  }, [member.isPending, member.data, navigate]);

  if (member.isPending) {
    return (
      <SiteChrome {...CHROME}>
        <div className="px-6 py-10">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </SiteChrome>
    );
  }

  if (!member.data) {
    return null;
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="grid gap-6 px-6 py-8 md:grid-cols-[220px_1fr]">
        <SideNav
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
        <div
          onClickCapture={(e) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (href === "#deals") setSection("deals");
            if (href === "#accounts") setSection("accounts");
            if (href === "#playbook") setSection("playbook");
          }}
        >
          {section === "deals" && <DealsSection />}
          {section === "accounts" && <AccountsSection />}
          {section === "playbook" && <PlaybookSection />}
        </div>
      </div>
    </SiteChrome>
  );
}

function DealsSection() {
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const updateStage = useUpdateRow<Deal>("deals");
  const del = useDeleteRow("deals");
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });

  const filtered = useMemo(() => {
    const rows = deals.data ?? [];
    return rows.filter((d) => {
      const matchesQuery = query
        ? d.title.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesStage = stageFilter ? d.stage === stageFilter : true;
      return matchesQuery && matchesStage;
    });
  }, [deals.data, query, stageFilter]);

  const columns: Column<Deal>[] = [
    { key: "title", header: "Deal", render: (r) => r.title },
    { key: "value", header: "Value", render: (r) => r.value ?? "—" },
    {
      key: "stage",
      header: "Stage",
      render: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "new"}</StatusBadge>,
    },
  ];

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

  const toggleSelected = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const bulkSetStage = (stage: string) => {
    selected.forEach((id) => {
      updateStage.mutate(
        { id, stage },
        {
          onError: (e) => toast.error(e.message),
        },
      );
    });
    toast.success(`Moved ${selected.length} deal(s) to ${stage}`);
    setSelected([]);
  };

  const bulkDelete = () => {
    selected.forEach((id) => {
      del.mutate(id, { onError: (e) => toast.error(e.message) });
    });
    toast.success(`Deleted ${selected.length} deal(s)`);
    setSelected([]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone on the team reads and edits these — add one and it's shared instantly.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="motion-press">New record</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New deal</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-4">
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
        <FilterBar
          filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
          onRemove={() => setStageFilter(null)}
          onClear={() => setStageFilter(null)}
        >
          <Select value={stageFilter ?? "all"} onValueChange={(v) => setStageFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      </div>

      {selected.length > 0 && (
        <BulkActions
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: "Mark qualified", onSelect: () => bulkSetStage("qualified") },
            { label: "Mark won", onSelect: () => bulkSetStage("won") },
            { label: "Mark lost", onSelect: () => bulkSetStage("lost") },
            { label: "Delete", onSelect: bulkDelete, destructive: true },
          ]}
        />
      )}

      <div className="mt-4">
        {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
        {deals.isError && (
          <p className="text-sm text-destructive">Couldn't load the pipeline. Refresh and try again.</p>
        )}
        {deals.data && deals.data.length === 0 && (
          <Empty
            title="No deals yet"
            description="Add the first deal your team is working and it'll show up here for everyone."
          />
        )}
        {deals.data && deals.data.length > 0 && filtered.length === 0 && (
          <Empty title="No matches" description="Try a different search or clear the stage filter." />
        )}
        {filtered.length > 0 && (
          <DataTable
            columns={[
              {
                key: "select",
                header: "",
                render: (r) => (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleSelected(r.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
              },
              ...columns,
            ]}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
          />
        )}
      </div>
    </div>
  );
}

function AccountsSection() {
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const create = useCreateRow<Account>("accounts");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const filtered = useMemo(() => {
    const rows = accounts.data ?? [];
    return query
      ? rows.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      : rows;
  }, [accounts.data, query]);

  const onCreate = (values: AccountForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every account anyone on the team has added — shared across the whole roster.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="motion-press">New record</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New account</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
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
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search accounts"
          count={filtered.length}
          total={accounts.data?.length ?? 0}
        />
      </div>

      <div className="mt-4">
        {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
        {accounts.isError && (
          <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
        )}
        {accounts.data && accounts.data.length === 0 && (
          <Empty title="No accounts yet" description="Add the first account your team is selling into." />
        )}
        {accounts.data && accounts.data.length > 0 && filtered.length === 0 && (
          <Empty title="No matches" description="Try a different search." />
        )}
        {filtered.length > 0 && (
          <ul className="mt-2 grid gap-3 motion-stagger">
            {filtered.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium">{a.name}</p>
                {a.website && (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm text-muted-foreground underline underline-offset-4"
                  >
                    {a.website}
                  </a>
                )}
                {a.notes && <p className="mt-2 text-sm text-muted-foreground">{a.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PlaybookSection() {
  const playbook = useRows<Row & { title: string; body: string | null }>("playbook", {
    order: "id",
    dir: "desc",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Maintained by the business — reference material, not something you edit here.
      </p>

      <div className="mt-6">
        {playbook.isPending && <Skeleton className="h-64 rounded-xl" />}
        {playbook.isError && (
          <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
        )}
        {playbook.data && playbook.data.length === 0 && (
          <Empty title="Nothing published yet" description="Plays will show up here once the team adds them." />
        )}
        {playbook.data && playbook.data.length > 0 && (
          <ul className="mt-2 grid gap-3 motion-stagger">
            {playbook.data.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium">{p.title}</p>
                {p.body && <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

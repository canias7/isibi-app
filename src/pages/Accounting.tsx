import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Receipt, BookOpen, BarChart3,
  MessageSquare, Plus, Trash2, X, ChevronRight, PanelLeftClose,
  PanelLeftOpen, TrendingUp, TrendingDown, DollarSign, Clock,
  CheckCircle, Send, Sparkles, Loader2, ArrowLeft, Pencil,
} from "lucide-react";
import {
  listAccounts, createAccount, deleteAccount,
  listInvoices, createInvoice, updateInvoice, deleteInvoice,
  listExpenses, createExpense, deleteExpense,
  getPLReport, getBalanceSheet, accAIChat,
  type AccountingAccount, type AccountingInvoice,
  type AccountingExpense, type AccountingInvoiceItem,
  type PLReport, type BalanceSheet,
} from "@/lib/api";

type View = "dashboard" | "invoices" | "expenses" | "accounts" | "reports";

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard",        icon: LayoutDashboard },
  { id: "invoices",  label: "Invoices",          icon: FileText },
  { id: "expenses",  label: "Expenses",          icon: Receipt },
  { id: "accounts",  label: "Chart of Accounts", icon: BookOpen },
  { id: "reports",   label: "Reports",           icon: BarChart3 },
];

const STATUS_COLORS: Record<string, string> = {
  draft:   "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  sent:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  paid:    "bg-green-500/15 text-green-400 border-green-500/30",
  overdue: "bg-red-500/15 text-red-400 border-red-500/30",
};

const EXPENSE_CATS = ["General","Payroll","Rent","Marketing","Software & Tools",
  "Travel","Utilities","Cost of Goods Sold","Legal & Professional","Insurance","Other"];

const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardView({ invoices, expenses }: { invoices: AccountingInvoice[]; expenses: AccountingExpense[] }) {
  const revenue    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const totalExp   = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const net        = revenue - totalExp;
  const unpaid     = invoices.filter(i => ["sent","overdue","draft"].includes(i.status)).reduce((s, i) => s + Number(i.total), 0);

  const cards = [
    { label: "Total Revenue",   value: fmt(revenue),  icon: TrendingUp,   color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
    { label: "Total Expenses",  value: fmt(totalExp), icon: TrendingDown, color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
    { label: "Net Profit",      value: fmt(net),      icon: DollarSign,   color: net >= 0 ? "text-emerald-400" : "text-red-400", bg: "bg-primary/10 border-primary/20" },
    { label: "Unpaid Invoices", value: fmt(unpaid),   icon: Clock,        color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  ];

  // Monthly bars (last 6 months)
  const months: { label: string; rev: number; exp: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short" });
    const rev = invoices.filter(inv => inv.status === "paid" && (inv.date ?? "").startsWith(ym)).reduce((s, inv) => s + Number(inv.total), 0);
    const exp = expenses.filter(e => (e.date ?? "").startsWith(ym)).reduce((s, e) => s + Number(e.amount), 0);
    months.push({ label, rev, exp });
  }
  const maxVal = Math.max(...months.map(m => Math.max(m.rev, m.exp)), 1);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className={cn("rounded-2xl border p-4 flex flex-col gap-2", c.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <span className={cn("text-xl font-bold", c.color)}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-2xl border border-border/30 bg-card/20 p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Revenue vs Expenses (6 months)</h3>
        <div className="flex items-end gap-3 h-32">
          {months.map(m => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5" style={{ height: 100 }}>
                <div className="flex-1 rounded-t bg-green-500/50 transition-all" style={{ height: `${(m.rev / maxVal) * 100}%` }} title={`Revenue: ${fmt(m.rev)}`} />
                <div className="flex-1 rounded-t bg-red-500/40 transition-all" style={{ height: `${(m.exp / maxVal) * 100}%` }} title={`Expenses: ${fmt(m.exp)}`} />
              </div>
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/50 inline-block"/>Revenue</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/40 inline-block"/>Expenses</span>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="rounded-2xl border border-border/30 bg-card/20 p-5">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Recent Invoices</h3>
        {invoices.length === 0 ? <p className="text-xs text-muted-foreground">No invoices yet.</p> : (
          <div className="space-y-2">
            {invoices.slice(0, 5).map(inv => (
              <div key={inv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                <div>
                  <span className="font-medium">{inv.invoice_number}</span>
                  <span className="text-muted-foreground ml-2">{inv.client_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[inv.status])}>{inv.status}</span>
                  <span className="font-semibold">{fmt(Number(inv.total))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invoices ──────────────────────────────────────────────────────────────────
function InvoicesView({ invoices, onRefresh }: { invoices: AccountingInvoice[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client_name: "", client_email: "", date: "", due_date: "", notes: "", tax_rate: "0" });
  const [items, setItems] = useState<AccountingInvoiceItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const taxAmt   = subtotal * (parseFloat(form.tax_rate) || 0) / 100;
  const total    = subtotal + taxAmt;

  async function handleSave() {
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      await createInvoice({ ...form, tax_rate: parseFloat(form.tax_rate) || 0, items });
      toast({ title: "Invoice created" });
      setShowModal(false);
      setForm({ client_name: "", client_email: "", date: "", due_date: "", notes: "", tax_rate: "0" });
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      onRefresh();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function markPaid(id: number) {
    await updateInvoice(id, { status: "paid" as any }).catch(() => null);
    onRefresh();
    toast({ title: "Marked as paid" });
  }

  async function handleDelete(id: number) {
    await deleteInvoice(id).catch(() => null);
    onRefresh();
    toast({ title: "Invoice deleted" });
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Invoices</h2>
        <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" />New Invoice</Button>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No invoices yet. Create your first one.</div>
      ) : (
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/40 border-b border-border/30">
              <tr>{["#","Client","Date","Due","Status","Total",""].map(h => <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border/20 hover:bg-card/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <div>{inv.client_name}</div>
                    {inv.client_email && <div className="text-xs text-muted-foreground">{inv.client_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.date ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.due_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[inv.status])}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(Number(inv.total))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {inv.status !== "paid" && (
                        <button onClick={() => markPaid(inv.id)} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />Paid
                        </button>
                      )}
                      <button onClick={() => handleDelete(inv.id)} className="text-muted-foreground hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/30 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold">New Invoice</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2"><Label>Client Name *</Label><Input value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} placeholder="Acme Corp" /></div>
                <div className="space-y-1.5 col-span-2"><Label>Client Email</Label><Input type="email" value={form.client_email} onChange={e => setForm(f => ({...f, client_email: e.target.value}))} placeholder="client@example.com" /></div>
                <div className="space-y-1.5"><Label>Invoice Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} /></div>
                <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} /></div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Line Items</Label><button onClick={() => setItems(it => [...it, { description: "", quantity: 1, unit_price: 0 }])} className="text-xs text-primary flex items-center gap-1"><Plus className="h-3 w-3" />Add item</button></div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-6" placeholder="Description" value={item.description} onChange={e => setItems(it => it.map((x, j) => j === i ? {...x, description: e.target.value} : x))} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={item.quantity} onChange={e => setItems(it => it.map((x, j) => j === i ? {...x, quantity: parseFloat(e.target.value) || 0} : x))} />
                    <Input className="col-span-3" type="number" placeholder="Price" value={item.unit_price} onChange={e => setItems(it => it.map((x, j) => j === i ? {...x, unit_price: parseFloat(e.target.value) || 0} : x))} />
                    <button className="col-span-1 text-muted-foreground hover:text-red-400" onClick={() => setItems(it => it.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Tax Rate (%)</Label><Input type="number" value={form.tax_rate} onChange={e => setForm(f => ({...f, tax_rate: e.target.value}))} placeholder="0" /></div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Optional note" /></div>
              </div>

              <div className="bg-card/50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax ({form.tax_rate}%)</span><span>{fmt(taxAmt)}</span></div>
                <div className="flex justify-between font-bold border-t border-border/30 pt-1 mt-1"><span>Total</span><span>{fmt(total)}</span></div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !form.client_name.trim()} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Invoice"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expenses ──────────────────────────────────────────────────────────────────
function ExpensesView({ expenses, onRefresh }: { expenses: AccountingExpense[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: "", description: "", category: "General", amount: "", vendor: "" });
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("all");

  async function handleSave() {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      await createExpense({ ...form, amount: parseFloat(form.amount) });
      toast({ title: "Expense added" });
      setShowModal(false);
      setForm({ date: "", description: "", category: "General", amount: "", vendor: "" });
      onRefresh();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    await deleteExpense(id).catch(() => null);
    onRefresh();
    toast({ title: "Expense deleted" });
  }

  const filtered = filterCat === "all" ? expenses : expenses.filter(e => e.category === filterCat);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Expenses</h2>
        <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" />Add Expense</Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", ...EXPENSE_CATS.slice(0, 6)].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", filterCat === cat ? "bg-primary/10 border-primary/30 text-primary" : "border-border/30 text-muted-foreground hover:text-foreground")}>
            {cat === "all" ? "All" : cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No expenses yet.</div>
      ) : (
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/40 border-b border-border/30">
              <tr>{["Date","Description","Category","Vendor","Amount",""].map(h => <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id} className="border-b border-border/20 hover:bg-card/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{exp.date ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{exp.description}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-secondary/60 border border-border/30">{exp.category}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{exp.vendor ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-red-400">{fmt(Number(exp.amount))}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(exp.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="sticky top-0 bg-card border-b border-border/30 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5"><Label>Description *</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Office supplies" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00" /></div>
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} /></div>
              </div>
              <div className="space-y-1.5"><Label>Category</Label>
                <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm">
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm(f => ({...f, vendor: e.target.value}))} placeholder="Vendor name" /></div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !form.description.trim() || !form.amount} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Expense"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────
function AccountsView({ accounts, onRefresh }: { accounts: AccountingAccount[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", type: "asset", code: "", description: "" });
  const [saving, setSaving] = useState(false);
  const types = ["asset","liability","equity","revenue","expense"] as const;

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createAccount(form);
      toast({ title: "Account created" });
      setShowModal(false);
      setForm({ name: "", type: "asset", code: "", description: "" });
      onRefresh();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    await deleteAccount(id).catch(() => null);
    onRefresh();
    toast({ title: "Account removed" });
  }

  const TYPE_COLORS: Record<string, string> = {
    asset:     "text-blue-400",
    liability: "text-orange-400",
    equity:    "text-purple-400",
    revenue:   "text-green-400",
    expense:   "text-red-400",
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Chart of Accounts</h2>
        <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" />New Account</Button>
      </div>

      {types.map(type => {
        const group = accounts.filter(a => a.type === type);
        if (!group.length) return null;
        return (
          <div key={type} className="mb-5">
            <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-2", TYPE_COLORS[type])}>{type}s</h3>
            <div className="rounded-xl border border-border/30 overflow-hidden">
              {group.map((acc, i) => (
                <div key={acc.id} className={cn("flex items-center justify-between px-4 py-2.5 text-sm hover:bg-card/30 transition-colors", i !== group.length - 1 && "border-b border-border/20")}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-12">{acc.code ?? "—"}</span>
                    <span className="font-medium">{acc.name}</span>
                    {acc.is_system === 1 && <span className="text-[10px] bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded-full border border-border/20">system</span>}
                  </div>
                  {acc.is_system !== 1 && (
                    <button onClick={() => handleDelete(acc.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="sticky top-0 bg-card border-b border-border/30 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold">New Account</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Bank Account" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Type</Label>
                  <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm capitalize">
                    {types.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} placeholder="e.g. 1050" /></div>
              </div>
              <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Optional" /></div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsView() {
  const [tab, setTab] = useState<"pl" | "bs">("pl");
  const [pl, setPl] = useState<PLReport | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([getPLReport(dateFrom || undefined, dateTo || undefined), getBalanceSheet()]);
      setPl(p); setBs(b);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Financial Reports</h2>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
          <span className="text-muted-foreground text-xs">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-xs" />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Run"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {([["pl","Profit & Loss"],["bs","Balance Sheet"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-colors", tab === id ? "bg-primary/10 border-primary/30 text-primary" : "border-border/30 text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "pl" && pl && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Revenue", value: fmt(pl.revenue), color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Expenses", value: fmt(pl.expenses), color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "Net Profit", value: fmt(pl.net), color: pl.net >= 0 ? "text-emerald-400" : "text-red-400", bg: "bg-primary/10 border-primary/20" },
            ].map(c => (
              <div key={c.label} className={cn("rounded-2xl border p-4", c.bg)}>
                <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                <div className={cn("text-xl font-bold", c.color)}>{c.value}</div>
              </div>
            ))}
          </div>

          {pl.by_category.length > 0 && (
            <div className="rounded-xl border border-border/30 overflow-hidden">
              <div className="px-4 py-3 bg-card/40 border-b border-border/30 text-xs font-medium text-muted-foreground">Expenses by Category</div>
              {pl.by_category.map((row, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 last:border-0 text-sm">
                  <span>{row.category}</span>
                  <span className="font-semibold text-red-400">{fmt(row.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bs" && bs && (
        <div className="space-y-4">
          {[
            { title: "Assets", data: [["Cash / Bank", bs.assets.cash], ["Accounts Receivable", bs.assets.accounts_receivable], ["Total Assets", bs.assets.total]], bold: 2, color: "text-blue-400" },
            { title: "Liabilities", data: [["Total Liabilities", bs.liabilities.total]], bold: 0, color: "text-orange-400" },
            { title: "Equity", data: [["Retained Earnings", bs.equity.retained_earnings], ["Total Equity", bs.equity.total]], bold: 1, color: "text-purple-400" },
          ].map(section => (
            <div key={section.title} className="rounded-xl border border-border/30 overflow-hidden">
              <div className={cn("px-4 py-3 bg-card/40 border-b border-border/30 text-xs font-bold uppercase tracking-widest", section.color)}>{section.title}</div>
              {section.data.map(([label, val], i) => (
                <div key={String(label)} className={cn("flex items-center justify-between px-4 py-2.5 border-b border-border/20 last:border-0 text-sm", i === section.bold && "font-bold bg-card/20")}>
                  <span>{label}</span>
                  <span>{fmt(Number(val))}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Chat Drawer ─────────────────────────────────────────────────────────────
function AIChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setLoading(true);
    try {
      const { reply } = await accAIChat(text, updated.slice(-10));
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-card border-l border-border/30 flex flex-col z-30 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Accountant</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-xs pt-8 space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-primary/40" />
            <p>Ask me anything about your finances.</p>
            {["What's my total revenue?","Show unpaid invoices","What's my net profit?"].map(q => (
              <button key={q} onClick={() => { setInput(q); }} className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">{q}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[90%] px-3 py-2 rounded-xl text-sm", m.role === "user" ? "ml-auto bg-primary text-white" : "bg-secondary/50 text-foreground")}>
            {m.content}
          </div>
        ))}
        {loading && <div className="bg-secondary/50 rounded-xl px-3 py-2 w-16"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      </div>

      <div className="p-3 border-t border-border/30 flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about your finances…" className="flex-1 text-sm" />
        <Button size="sm" onClick={send} disabled={loading || !input.trim()}><Send className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Accounting() {
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [expenses, setExpenses] = useState<AccountingExpense[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);

  async function loadAll() {
    const [inv, exp, acc] = await Promise.all([listInvoices(), listExpenses(), listAccounts()]);
    setInvoices(inv ?? []); setExpenses(exp ?? []); setAccounts(acc ?? []);
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <div className={cn("flex h-screen bg-background overflow-hidden", chatOpen && "pr-80")}>
      {/* Sidebar */}
      <aside className={cn("flex flex-col shrink-0 border-r border-border/30 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 transition-all duration-300", collapsed ? "w-16" : "w-52")}>
        <div className="flex items-center gap-2 px-3 h-16 border-b border-border/30 shrink-0">
          {!collapsed && <span className="text-lg font-bold gradient-text flex-1">Accounting</span>}
          <button onClick={() => setCollapsed(v => !v)} className={cn("p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors", collapsed && "mx-auto")}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all", collapsed && "justify-center px-2", view === item.id ? "bg-primary/10 text-primary border border-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50")}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-2 pb-3">
          <a href="/crm-agent" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all", collapsed && "justify-center px-2")}>
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to CRM</span>}
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-border/30 bg-card/20 shrink-0">
          <div>
            <h1 className="text-base font-bold">
              {NAV.find(n => n.id === view)?.label}
            </h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => setChatOpen(o => !o)} className={cn(chatOpen && "bg-primary/10 border-primary/30 text-primary")}>
            <Sparkles className="h-4 w-4 mr-1.5" />AI Accountant
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "dashboard" && <DashboardView invoices={invoices} expenses={expenses} />}
          {view === "invoices"  && <InvoicesView  invoices={invoices}  onRefresh={loadAll} />}
          {view === "expenses"  && <ExpensesView  expenses={expenses}  onRefresh={loadAll} />}
          {view === "accounts"  && <AccountsView  accounts={accounts}  onRefresh={loadAll} />}
          {view === "reports"   && <ReportsView />}
        </div>
      </div>

      <AIChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

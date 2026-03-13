import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, Phone, Mail, Building2, Pencil, Trash2,
  ChevronDown, X, Upload, Download, StickyNote, Clock, PhoneCall,
  CheckCircle2, XCircle, RefreshCw, AlertCircle, Star, Filter,
  LogOut, PanelLeftClose, PanelLeftOpen, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  listContacts, createContact, updateContact, deleteContact,
  importContacts, updateContactStatus, addContactNote, listContactNotes,
  type Contact, type ContactCreateRequest,
} from "@/lib/api";

// ── Pipeline statuses (Ringy-style dispositions) ────────────────────────────

const STATUSES = [
  { id: "new_lead",        label: "New Lead",       color: "bg-blue-500/15 text-blue-400 border-blue-500/30",    dot: "bg-blue-400" },
  { id: "contacted",       label: "Contacted",      color: "bg-purple-500/15 text-purple-400 border-purple-500/30", dot: "bg-purple-400" },
  { id: "callback",        label: "Callback",       color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400" },
  { id: "interested",      label: "Interested",     color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  { id: "not_interested",  label: "Not Interested", color: "bg-slate-500/15 text-slate-400 border-slate-500/30",  dot: "bg-slate-400" },
  { id: "closed_won",      label: "Closed Won",     color: "bg-green-500/15 text-green-400 border-green-500/30",  dot: "bg-green-400" },
  { id: "closed_lost",     label: "Closed Lost",    color: "bg-red-500/15 text-red-400 border-red-500/30",        dot: "bg-red-400" },
] as const;

const SOURCES = ["Manual", "CSV Import", "Website Form", "Referral", "Social Media", "Cold Call", "Other"];

function statusMeta(id?: string | null) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}

function initials(c: Contact) {
  return `${c.first_name[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase();
}

function fullName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function formatDate(s?: string | null) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return s; }
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text: string): ContactCreateRequest[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const out: ContactCreateRequest[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    const phone = row["phone_number"] || row["phone"] || row["mobile"] || "";
    const first = row["first_name"] || row["first"] || row["name"]?.split(" ")[0] || "";
    if (!phone || !first) continue;
    out.push({
      first_name: first,
      last_name: row["last_name"] || row["last"] || row["name"]?.split(" ").slice(1).join(" ") || undefined,
      phone_number: phone,
      email: row["email"] || undefined,
      company: row["company"] || row["company_name"] || undefined,
      notes: row["notes"] || undefined,
    });
  }
  return out;
}

// ── Contact Form Modal ───────────────────────────────────────────────────────

interface ContactFormProps {
  initial?: Contact;
  onSave: (data: ContactCreateRequest) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ContactForm({ initial, onSave, onCancel, saving }: ContactFormProps) {
  const [form, setForm] = useState<ContactCreateRequest>({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    phone_number: initial?.phone_number ?? "",
    email: initial?.email ?? "",
    company: initial?.company ?? "",
    address: (initial as any)?.address ?? "",
    notes: initial?.notes ?? "",
    status: (initial as any)?.status ?? "new_lead",
    source: (initial as any)?.source ?? "",
  });
  const set = (k: keyof ContactCreateRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border/30 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold">{initial ? "Edit Contact" : "Add Contact"}</h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={form.first_name} onChange={set("first_name")} placeholder="John" />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={form.last_name ?? ""} onChange={set("last_name")} placeholder="Doe" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input value={form.phone_number} onChange={set("phone_number")} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={set("email")} placeholder="john@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={form.company ?? ""} onChange={set("company")} placeholder="Acme Corp" />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={(form as any).address ?? ""} onChange={set("address" as any)} placeholder="123 Main St, Miami FL" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={(form as any).status ?? "new_lead"}
                onChange={set("status" as any)}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm"
              >
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <select
                value={(form as any).source ?? ""}
                onChange={set("source" as any)}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm"
              >
                <option value="">Select source</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={set("notes")} placeholder="Initial notes about this contact…" rows={3} className="bg-background/50" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>Cancel</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={saving || !form.first_name || !form.phone_number}
              className="flex-1"
            >
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Contact"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Contact Detail Panel ─────────────────────────────────────────────────────

interface DetailPanelProps {
  contact: Contact;
  onClose: () => void;
  onStatusChange: (id: number, status: string, disposition?: string) => Promise<void>;
  onEdit: (c: Contact) => void;
  onDelete: (id: number) => void;
}

function DetailPanel({ contact, onClose, onStatusChange, onEdit, onDelete }: DetailPanelProps) {
  const [notes, setNotes] = useState<{ id: number; note: string; created_at: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const sm = statusMeta(contact.status);

  useEffect(() => {
    setLoadingNotes(true);
    listContactNotes(contact.id)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  }, [contact.id]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const n = await addContactNote(contact.id, noteText.trim());
      setNotes((prev) => [n, ...prev]);
      setNoteText("");
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-border/30 bg-card/60 backdrop-blur-xl w-full max-w-sm shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <span className="font-semibold text-sm">Contact Details</span>
        <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Avatar + name */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary mx-auto">
            {initials(contact)}
          </div>
          <div>
            <p className="font-semibold text-lg">{fullName(contact)}</p>
            {contact.company && <p className="text-sm text-muted-foreground">{contact.company}</p>}
          </div>
          <Badge className={cn("text-xs border", sm.color)}>{sm.label}</Badge>
        </div>

        {/* Contact info */}
        <div className="space-y-2 text-sm">
          <a href={`tel:${contact.phone_number}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <Phone className="h-3.5 w-3.5 shrink-0" />{contact.phone_number}
          </a>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <Mail className="h-3.5 w-3.5 shrink-0" />{contact.email}
            </a>
          )}
          {(contact as any).address && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />{(contact as any).address}
            </p>
          )}
        </div>

        {/* Status change */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Update Status</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => onStatusChange(contact.id, s.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left",
                  contact.status === s.id
                    ? cn(s.color, "border-current")
                    : "border-border/30 text-muted-foreground hover:bg-secondary/50"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />
                {s.label}
                {contact.status === s.id && <CheckCircle2 className="h-3 w-3 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(contact as any).call_count != null && (
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="font-bold text-base text-primary">{(contact as any).call_count}</p>
              <p className="text-muted-foreground">Calls</p>
            </div>
          )}
          {(contact as any).last_contacted && (
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="font-bold text-xs text-foreground">{formatDate((contact as any).last_contacted)}</p>
              <p className="text-muted-foreground">Last Contact</p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><StickyNote className="h-3 w-3" /> Activity & Notes</Label>
          <div className="flex gap-2">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              className="text-xs h-8"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddNote()}
            />
            <Button size="sm" onClick={handleAddNote} disabled={addingNote || !noteText.trim()} className="h-8 px-3 text-xs">
              Add
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {loadingNotes ? (
              <p className="text-xs text-muted-foreground text-center py-2">Loading…</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No notes yet</p>
            ) : notes.map((n) => (
              <div key={n.id} className="bg-secondary/20 rounded-lg px-3 py-2 text-xs space-y-1">
                <p>{n.note}</p>
                <p className="text-muted-foreground">{formatDate(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border/30 p-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onEdit(contact)} className="flex-1 text-xs h-8">
          <Pencil className="h-3 w-3 mr-1.5" /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(contact.id)}
          className="flex-1 text-xs h-8 text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <Trash2 className="h-3 w-3 mr-1.5" /> Delete
        </Button>
      </div>
    </div>
  );
}

// ── Main CRM Page ─────────────────────────────────────────────────────────────

export default function CRMAgent() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    listContacts()
      .then(setContacts)
      .catch(() => toast({ title: "Failed to load contacts", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      fullName(c).toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || (c as any).status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.id] = contacts.filter((c) => (c as any).status === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  const handleSave = async (data: ContactCreateRequest) => {
    setSaving(true);
    try {
      if (editContact) {
        const updated = await updateContact(editContact.id, data);
        setContacts((prev) => prev.map((c) => c.id === editContact.id ? { ...c, ...updated, ...data } : c));
        if (selected?.id === editContact.id) setSelected((s) => s ? { ...s, ...data } : s);
        toast({ title: "Contact updated" });
      } else {
        await createContact(data);
        load();
        toast({ title: "Contact added" });
      }
      setShowForm(false);
      setEditContact(null);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: number, status: string, disposition?: string) => {
    try {
      await updateContactStatus(id, status, disposition);
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } as any : c));
      if (selected?.id === id) setSelected((s) => s ? { ...s, status } as any : s);
      toast({ title: `Status → ${statusMeta(status).label}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) setSelected(null);
      toast({ title: "Contact deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      if (!parsed.length) { toast({ title: "No valid rows found in CSV", variant: "destructive" }); return; }
      try {
        const { created, errors } = await importContacts(parsed);
        toast({ title: `Imported ${created} contacts${errors ? ` (${errors} skipped)` : ""}` });
        load();
      } catch {
        toast({ title: "Import failed", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadSample = () => {
    const csv = "first_name,last_name,phone_number,email,company,notes\nJohn,Doe,+13055551234,john@example.com,Acme Corp,\nJane,Smith,+13055555678,jane@example.com,,Call back Friday";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "contacts_sample.csv";
    a.click();
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col shrink-0 border-r border-border/30 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-52"
      )}>
        <div className="flex items-center gap-2 px-3 h-16 border-b border-border/30 shrink-0">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold gradient-text">CRM Agent</span>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className={cn("p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors", sidebarCollapsed && "mx-auto")}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {[
            { id: "all",           label: "All Contacts",    icon: Users,        count: contacts.length },
            ...STATUSES.map((s) => ({ id: s.id, label: s.label, icon: ChevronDown, count: counts[s.id] ?? 0, color: s.dot })),
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterStatus(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                sidebarCollapsed && "justify-center px-2",
                filterStatus === item.id
                  ? "bg-primary/10 text-primary border border-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {"color" in item
                ? <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", (item as any).color)} />
                : <item.icon className="h-4 w-4 shrink-0" />
              }
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count > 0 && (
                    <span className="text-xs bg-secondary/60 rounded-full px-1.5 py-0.5">{item.count}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-border/30 p-3 space-y-1">
          <button
            onClick={() => navigate("/developer-dashboard")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <Bot className="h-4 w-4" />
            {!sidebarCollapsed && "Voice Agent"}
          </button>
          <button
            onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("account_type"); navigate("/"); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && "Log Out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-border/30 bg-card/20 shrink-0">
          <div className="flex-1">
            <h1 className="text-xl font-bold">
              {filterStatus === "all" ? "All Contacts" : statusMeta(filterStatus).label}
            </h1>
            <p className="text-xs text-muted-foreground">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="pl-9 h-8 text-sm bg-background/50"
            />
          </div>
          <Button size="sm" variant="outline" onClick={downloadSample} className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" /> Sample CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-8 text-xs gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => { setEditContact(null); setShowForm(true); }} className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Contact
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
        </div>

        {/* Pipeline summary bar */}
        <div className="flex gap-2 px-6 py-3 border-b border-border/20 overflow-x-auto shrink-0 bg-background/30">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStatus(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all",
                filterStatus === s.id ? cn(s.color, "border-current") : "border-border/30 text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", s.dot)} />
              {s.label}
              <span className="font-bold">{counts[s.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Contact list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading contacts…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                <Users className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">
                  {search || filterStatus !== "all" ? "No contacts match your filter" : "No contacts yet"}
                </p>
                {!search && filterStatus === "all" && (
                  <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add your first contact
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((c) => {
                  const sm = statusMeta((c as any).status);
                  const isActive = selected?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelected(isActive ? null : c)}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all",
                        isActive
                          ? "bg-primary/5 border-primary/20"
                          : "bg-card/40 border-border/30 hover:bg-secondary/30 hover:border-border/50"
                      )}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {initials(c)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{fullName(c)}</span>
                          <Badge className={cn("text-[10px] px-1.5 py-0 border shrink-0", sm.color)}>{sm.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone_number}</span>
                          {c.company && <span className="flex items-center gap-1 truncate"><Building2 className="h-3 w-3" />{c.company}</span>}
                          {c.email && <span className="truncate hidden sm:flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="text-right shrink-0 hidden md:block">
                        {(c as any).last_contacted && (
                          <p className="text-xs text-muted-foreground">{formatDate((c as any).last_contacted)}</p>
                        )}
                        {(c as any).source && (
                          <p className="text-xs text-muted-foreground/60">{(c as any).source}</p>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <a href={`tel:${c.phone_number}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => { setEditContact(c); setShowForm(true); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <DetailPanel
              contact={selected}
              onClose={() => setSelected(null)}
              onStatusChange={handleStatusChange}
              onEdit={(c) => { setEditContact(c); setShowForm(true); }}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <ContactForm
          initial={editContact ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditContact(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}

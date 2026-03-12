import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, X, Pencil, Trash2, Phone, Mail,
  Building2, Tag, FileText, Loader2, Upload, Download,
  ChevronDown, PhoneOutgoing, Check, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  type Contact,
  type ContactCreateRequest,
  type AgentOut,
} from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(c: Contact): string {
  return `${c.first_name[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase();
}

function fullName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

// Parse a CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text: string): ContactCreateRequest[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const contacts: ContactCreateRequest[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    const phone = row["phone_number"] || row["phone"] || row["mobile"] || "";
    const first = row["first_name"] || row["first"] || row["name"]?.split(" ")[0] || "";
    if (!phone || !first) continue;
    contacts.push({
      first_name: first,
      last_name: row["last_name"] || row["last"] || row["name"]?.split(" ").slice(1).join(" ") || undefined,
      phone_number: phone,
      email: row["email"] || undefined,
      company: row["company"] || row["company_name"] || undefined,
      notes: row["notes"] || undefined,
    });
  }
  return contacts;
}

// ── Contact Form ──────────────────────────────────────────────────────────────

interface ContactFormProps {
  initial?: Contact;
  onSave: (data: ContactCreateRequest) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ContactForm({ initial, onSave, onCancel, saving }: ContactFormProps) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [phone, setPhone] = useState(initial?.phone_number ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      phone_number: phone.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      tags: tags.length ? tags : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First Name *</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" required />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Phone Number *</Label>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" required />
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />Company <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" />Tags <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="e.g. lead, vip"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs text-primary font-medium">
                {t}
                <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" />Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context about this contact…" rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !firstName.trim() || !phone.trim()}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Check className="h-4 w-4 mr-2" />{initial ? "Save Changes" : "Add Contact"}</>}
        </Button>
      </div>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface DashboardContactsProps {
  agents?: AgentOut[];
  onCallContact?: (contact: Contact) => void;
}

export default function DashboardContacts({ agents, onCallContact }: DashboardContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const [importLoading, setImportLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchContacts = async () => {
    try {
      const data = await listContacts();
      setContacts(Array.isArray(data) ? data : []);
    } catch {
      // silently fail if backend not ready yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  // All unique tags across contacts
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags ?? [])));

  // Filtered list
  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || fullName(c).toLowerCase().includes(q) || c.phone_number.includes(q) || (c.company ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
    const matchTag = !tagFilter || (c.tags ?? []).includes(tagFilter);
    return matchSearch && matchTag;
  });

  // ── save ─────────────────────────────────────────────────────────────────────
  const handleSave = async (data: ContactCreateRequest) => {
    setSaving(true);
    try {
      if (mode === "edit" && editTarget) {
        const updated = await updateContact(editTarget.id, data);
        setContacts((prev) => prev.map((c) => (c.id === editTarget.id ? updated : c)));
        toast({ title: "Contact updated" });
      } else {
        const created = await createContact(data);
        setContacts((prev) => [created, ...prev]);
        toast({ title: "Contact added" });
      }
      setMode("list");
      setEditTarget(null);
    } catch (err: any) {
      toast({ title: "Failed to save contact", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Delete ${fullName(contact)}? This cannot be undone.`)) return;
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      toast({ title: "Contact deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete contact", description: err.message, variant: "destructive" });
    }
  };

  // ── CSV import ────────────────────────────────────────────────────────────────
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast({ title: "No valid contacts found in CSV", description: "Ensure columns: first_name, phone_number", variant: "destructive" });
        return;
      }
      const result = await importContacts(parsed);
      toast({ title: `Imported ${result.created} contacts${result.errors ? ` (${result.errors} skipped)` : ""}` });
      await fetchContacts();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const header = "first_name,last_name,phone_number,email,company,tags,notes";
    const rows = contacts.map((c) =>
      [c.first_name, c.last_name ?? "", c.phone_number, c.email ?? "", c.company ?? "", (c.tags ?? []).join(";"), c.notes ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contacts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your contact list for outbound calls.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {contacts.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importLoading}>
            {importLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Import CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileImport} />
          <Button onClick={() => { setMode("new"); setEditTarget(null); }}>
            <Plus className="h-4 w-4 mr-2" />Add Contact
          </Button>
        </div>
      </div>

      {/* Add / Edit form */}
      <AnimatePresence>
        {(mode === "new" || mode === "edit") && (
          <motion.div
            key="contact-form"
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {mode === "edit" ? `Edit ${fullName(editTarget!)}` : "New Contact"}
              </h3>
              <ContactForm
                initial={editTarget ?? undefined}
                onSave={handleSave}
                onCancel={() => { setMode("list"); setEditTarget(null); }}
                saving={saving}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + tag filter */}
      {contacts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setTagFilter(null)}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-colors", !tagFilter ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-colors", tagFilter === tag ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">No contacts yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Add contacts manually or import a CSV file.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => setMode("new")}>
              <Plus className="h-4 w-4 mr-2" />Add Contact
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />Import CSV
            </Button>
          </div>
          {/* CSV format hint */}
          <p className="mt-6 text-xs text-muted-foreground">
            CSV columns: <code className="bg-secondary px-1 py-0.5 rounded">first_name, last_name, phone_number, email, company, notes</code>
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center">
          <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No contacts match your search.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{filtered.length} of {contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-2">
            {filtered.map((contact) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-4 flex items-center gap-4 hover:border-primary/20 transition-colors group"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/15 shrink-0 text-primary text-sm font-bold">
                  {initials(contact)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{fullName(contact)}</p>
                    {contact.company && (
                      <span className="text-xs text-muted-foreground">· {contact.company}</span>
                    )}
                    {(contact.tags ?? []).map((tag) => (
                      <span key={tag} className="text-xs rounded-full bg-secondary border border-border/50 px-2 py-0.5 text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone_number}</span>
                    {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-sm">{contact.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {onCallContact && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-primary border-primary/30 hover:bg-primary/10 hover:text-primary"
                      onClick={() => onCallContact(contact)}
                      title="Call this contact"
                    >
                      <PhoneOutgoing className="h-3.5 w-3.5 mr-1" />Call
                    </Button>
                  )}
                  <button
                    onClick={() => { setEditTarget(contact); setMode("edit"); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

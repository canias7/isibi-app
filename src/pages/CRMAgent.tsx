import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, Phone, Mail, Building2, Pencil, Trash2,
  ChevronDown, X, Upload, Download, StickyNote, PhoneCall,
  CheckCircle2, Star, Filter, LogOut, PanelLeftClose, PanelLeftOpen,
  Bot, MessageSquare, Calendar, ClipboardList, LayoutDashboard,
  Send, ArrowLeft, Inbox, Clock, ChevronLeft, ChevronRight,
  AlertCircle, CheckSquare, Square, Paperclip, BarChart2, TrendingUp,
  Activity, RefreshCw, Zap, Layers, BarChart3, PhoneOff, PhoneIncoming,
  SkipForward, Play, Target, ArrowRight, Columns3,
  Sparkles, Globe, Wand2, CreditCard, Loader2, BotMessageSquare, Rocket,
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
  listContactCalls, listContactSMS, sendContactSMS,
  listContactEmails, addContactEmail,
  listContactAppointments, createContactAppointment, updateContactAppointment, deleteContactAppointment,
  listAllAppointments, listContactTasks, createContactTask,
  listAllTasks, updateTask, deleteTask,
  listCRMCalls, logCRMCall, deleteCRMCall,
  getCreditsBalance, listAgents, initiateOutboundCall, updateAgent,
  generateAIPromptAdvanced,
  type Contact, type ContactCreateRequest,
  type ContactCall, type ContactSMS, type ContactEmail,
  type Appointment, type Task, type CRMCall,
  type AgentOut,
} from "@/lib/api";
import {
  searchAvailableNumbers, purchasePhoneNumber, getMyPhoneNumbers, releasePhoneNumber,
  type AvailableNumber, type PurchasedNumber,
} from "@/lib/phone-numbers-api";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
  { id: "new_lead",       label: "New Lead",       color: "bg-blue-500/15 text-blue-400 border-blue-500/30",      dot: "bg-blue-400" },
  { id: "contacted",      label: "Contacted",      color: "bg-purple-500/15 text-purple-400 border-purple-500/30", dot: "bg-purple-400" },
  { id: "callback",       label: "Callback",       color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400" },
  { id: "interested",     label: "Interested",     color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  { id: "not_interested", label: "Not Interested", color: "bg-slate-500/15 text-slate-400 border-slate-500/30",    dot: "bg-slate-400" },
  { id: "closed_won",     label: "Closed Won",     color: "bg-green-500/15 text-green-400 border-green-500/30",    dot: "bg-green-400" },
  { id: "closed_lost",    label: "Closed Lost",    color: "bg-red-500/15 text-red-400 border-red-500/30",          dot: "bg-red-400" },
] as const;

const SOURCES = ["Manual", "CSV Import", "Website Form", "Referral", "Social Media", "Cold Call", "Other"];
const PRIORITIES = ["low", "medium", "high"] as const;
type View = "dashboard" | "contacts" | "calls" | "sms" | "emails" | "calendar" | "tasks" | "pipeline" | "power_dialer" | "reports" | "inbox" | "campaigns" | "phone_setup" | "my_prompt" | "billing";

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
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return s; }
}
function formatDateTime(s?: string | null) {
  if (!s) return null;
  try { return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return s; }
}
function formatDuration(sec?: number | null) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []; let cur = ""; let inQ = false;
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
      phone_number: phone, email: row["email"] || undefined,
      company: row["company"] || row["company_name"] || undefined, notes: row["notes"] || undefined,
    });
  }
  return out;
}

// ── Contact Form Modal ───────────────────────────────────────────────────────

function ContactForm({ initial, onSave, onCancel, saving }: {
  initial?: Contact; onSave: (d: ContactCreateRequest) => Promise<void>; onCancel: () => void; saving: boolean;
}) {
  const [form, setForm] = useState<ContactCreateRequest>({
    first_name: initial?.first_name ?? "", last_name: initial?.last_name ?? "",
    phone_number: initial?.phone_number ?? "", email: initial?.email ?? "",
    company: initial?.company ?? "", address: (initial as any)?.address ?? "",
    notes: initial?.notes ?? "", status: (initial as any)?.status ?? "new_lead",
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
          <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={set("first_name")} placeholder="John" /></div>
            <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.last_name ?? ""} onChange={set("last_name")} placeholder="Doe" /></div>
          </div>
          <div className="space-y-1.5"><Label>Phone Number *</Label><Input value={form.phone_number} onChange={set("phone_number")} placeholder="+1 (555) 000-0000" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={set("email")} placeholder="john@example.com" /></div>
          <div className="space-y-1.5"><Label>Company</Label><Input value={form.company ?? ""} onChange={set("company")} placeholder="Acme Corp" /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={(form as any).address ?? ""} onChange={set("address" as any)} placeholder="123 Main St" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select value={(form as any).status ?? "new_lead"} onChange={set("status" as any)}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm">
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <select value={(form as any).source ?? ""} onChange={set("source" as any)}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm">
                <option value="">Select source</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={set("notes")} placeholder="Initial notes…" rows={3} className="bg-background/50" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={() => onSave(form)} disabled={saving || !form.first_name || !form.phone_number} className="flex-1">
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Contact"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Appointment Modal ─────────────────────────────────────────────────────────

function AppointmentModal({ initial, contactId, contacts, onSave, onCancel, saving }: {
  initial?: Appointment; contactId?: number; contacts: Contact[];
  onSave: (cid: number, data: Omit<Appointment, "id">) => Promise<void>;
  onCancel: () => void; saving: boolean;
}) {
  const [cid, setCid] = useState<number>(contactId ?? initial?.contact_id ?? (contacts[0]?.id ?? 0));
  const [form, setForm] = useState({
    title: initial?.title ?? "", description: initial?.description ?? "",
    start_time: initial?.start_time ? initial.start_time.slice(0, 16) : "",
    end_time: initial?.end_time ? initial.end_time.slice(0, 16) : "",
    location: initial?.location ?? "", status: initial?.status ?? "scheduled",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Edit Appointment" : "New Appointment"}</h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!contactId && (
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <select value={cid} onChange={(e) => setCid(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm">
                {contacts.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Follow-up call" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start *</Label>
              <Input type="datetime-local" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} className="text-xs" />
            </div>
            <div className="space-y-1.5"><Label>End</Label>
              <Input type="datetime-local" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} className="text-xs" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Office / Zoom" />
          </div>
          <div className="space-y-1.5"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="bg-background/50" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={() => onSave(cid, { ...form, contact_id: cid })} disabled={saving || !form.title || !form.start_time} className="flex-1">
              {saving ? "Saving…" : initial ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────────────

function TaskModal({ initial, contactId, contacts, onSave, onCancel, saving }: {
  initial?: Task; contactId?: number; contacts: Contact[];
  onSave: (cid: number, data: Omit<Task, "id" | "completed">) => Promise<void>;
  onCancel: () => void; saving: boolean;
}) {
  const [cid, setCid] = useState<number>(contactId ?? initial?.contact_id ?? (contacts[0]?.id ?? 0));
  const [form, setForm] = useState({
    title: initial?.title ?? "", description: initial?.description ?? "",
    due_date: initial?.due_date ?? "", priority: initial?.priority ?? "medium",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Edit Task" : "New Task"}</h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!contactId && (
            <div className="space-y-1.5">
              <Label>Contact (optional)</Label>
              <select value={cid} onChange={(e) => setCid(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm">
                <option value={0}>No contact</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Send follow-up email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Priority</Label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="bg-background/50" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={() => onSave(cid, { ...form, contact_id: cid || undefined })} disabled={saving || !form.title} className="flex-1">
              {saving ? "Saving…" : initial ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Email Compose Modal ───────────────────────────────────────────────────────

function EmailModal({ contact, onSend, onCancel, sending }: {
  contact: Contact; onSend: (data: { subject: string; body: string }) => Promise<void>;
  onCancel: () => void; sending: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Compose Email</h2>
            <p className="text-xs text-muted-foreground">To: {contact.email || contact.phone_number}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Re: Follow up" />
          </div>
          <div className="space-y-1.5"><Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Write your email…" className="bg-background/50" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1" disabled={sending}>Cancel</Button>
            <Button onClick={() => onSend({ subject, body })} disabled={sending || !subject || !body} className="flex-1 gap-1.5">
              <Send className="h-3.5 w-3.5" />{sending ? "Sending…" : "Send / Log Email"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Contact Detail Panel ─────────────────────────────────────────────────────

type DetailTab = "overview" | "calls" | "sms" | "emails" | "calendar" | "notes" | "tasks";

function DetailPanel({ contact, onClose, onStatusChange, onEdit, onDelete, contacts, initialTab }: {
  contact: Contact; onClose: () => void;
  onStatusChange: (id: number, status: string) => Promise<void>;
  onEdit: (c: Contact) => void; onDelete: (id: number) => void;
  contacts: Contact[]; initialTab?: DetailTab;
}) {
  const [tab, setTab] = useState<DetailTab>(initialTab ?? "overview");
  const [notes, setNotes] = useState<{ id: number; note: string; created_at: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [calls, setCalls] = useState<ContactCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const [smsMessages, setSmsMessages] = useState<ContactSMS[]>([]);
  const [loadingSMS, setLoadingSMS] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [sendingSMS, setSendingSMS] = useState(false);
  const smsEndRef = useRef<HTMLDivElement>(null);

  const [emails, setEmails] = useState<ContactEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts] = useState(false);
  const [showAptModal, setShowAptModal] = useState(false);
  const [editApt, setEditApt] = useState<Appointment | undefined>();
  const [savingApt, setSavingApt] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const sm = statusMeta((contact as any).status);

  useEffect(() => {
    if (tab === "notes" && notes.length === 0) {
      setLoadingNotes(true);
      listContactNotes(contact.id).then(setNotes).catch(() => {}).finally(() => setLoadingNotes(false));
    }
    if (tab === "calls" && calls.length === 0) {
      setLoadingCalls(true);
      listContactCalls(contact.id).then(d => setCalls(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingCalls(false));
    }
    if (tab === "sms" && smsMessages.length === 0) {
      setLoadingSMS(true);
      listContactSMS(contact.id).then(setSmsMessages).catch(() => {}).finally(() => setLoadingSMS(false));
    }
    if (tab === "emails" && emails.length === 0) {
      setLoadingEmails(true);
      listContactEmails(contact.id).then(setEmails).catch(() => {}).finally(() => setLoadingEmails(false));
    }
    if (tab === "calendar" && appointments.length === 0) {
      setLoadingApts(true);
      listContactAppointments(contact.id).then(d => setAppointments(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingApts(false));
    }
    if (tab === "tasks" && tasks.length === 0) {
      setLoadingTasks(true);
      listContactTasks(contact.id).then(d => setTasks(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingTasks(false));
    }
  }, [tab, contact.id]);

  useEffect(() => {
    if (tab === "sms") smsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [smsMessages, tab]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const n = await addContactNote(contact.id, noteText.trim());
      setNotes((prev) => [n, ...prev]);
      setNoteText("");
    } catch { toast({ title: "Failed to add note", variant: "destructive" }); }
    finally { setAddingNote(false); }
  };

  const handleSendSMS = async () => {
    if (!smsText.trim()) return;
    setSendingSMS(true);
    try {
      const m = await sendContactSMS(contact.id, smsText.trim());
      setSmsMessages((prev) => [...prev, m as any]);
      setSmsText("");
    } catch { toast({ title: "Failed to send SMS", variant: "destructive" }); }
    finally { setSendingSMS(false); }
  };

  const handleSendEmail = async (data: { subject: string; body: string }) => {
    setSendingEmail(true);
    try {
      const e = await addContactEmail(contact.id, { ...data, to_address: contact.email ?? undefined });
      setEmails((prev) => [...prev, e]);
      setShowEmailCompose(false);
      toast({ title: "Email logged" });
    } catch { toast({ title: "Failed to log email", variant: "destructive" }); }
    finally { setSendingEmail(false); }
  };

  const handleSaveApt = async (cid: number, data: Omit<Appointment, "id">) => {
    setSavingApt(true);
    try {
      if (editApt) {
        await updateContactAppointment(contact.id, editApt.id, data);
        setAppointments((prev) => prev.map((a) => a.id === editApt.id ? { ...a, ...data } : a));
        toast({ title: "Appointment updated" });
      } else {
        const apt = await createContactAppointment(contact.id, data);
        setAppointments((prev) => [...prev, apt]);
        toast({ title: "Appointment created" });
      }
      setShowAptModal(false); setEditApt(undefined);
    } catch { toast({ title: "Failed to save appointment", variant: "destructive" }); }
    finally { setSavingApt(false); }
  };

  const handleDeleteApt = async (aptId: number) => {
    if (!confirm("Delete this appointment?")) return;
    try {
      await deleteContactAppointment(contact.id, aptId);
      setAppointments((prev) => prev.filter((a) => a.id !== aptId));
      toast({ title: "Appointment deleted" });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const handleSaveTask = async (cid: number, data: Omit<Task, "id" | "completed">) => {
    setSavingTask(true);
    try {
      const t = await createContactTask(contact.id, data);
      setTasks((prev) => [...prev, t]);
      setShowTaskModal(false);
      toast({ title: "Task created" });
    } catch { toast({ title: "Failed to create task", variant: "destructive" }); }
    finally { setSavingTask(false); }
  };

  const handleToggleTask = async (t: Task) => {
    try {
      await updateTask(t.id, { ...t, completed: !t.completed });
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, completed: !x.completed } : x));
    } catch { toast({ title: "Failed to update task", variant: "destructive" }); }
  };

  const TABS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Star },
    { id: "calls", label: "Calls", icon: PhoneCall },
    { id: "sms", label: "SMS", icon: MessageSquare },
    { id: "emails", label: "Emails", icon: Mail },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
    { id: "notes", label: "Notes", icon: StickyNote },
  ];

  return (
    <div className="flex flex-col h-full border-l border-border/30 bg-card/60 backdrop-blur-xl w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {initials(contact)}
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">{fullName(contact)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{contact.phone_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(contact)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => onDelete(contact.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 pt-2 pb-1 overflow-x-auto shrink-0 border-b border-border/20">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40")}>
            <t.icon className="h-3 w-3" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="p-4 space-y-4">
            <Badge className={cn("text-xs border", sm.color)}>{sm.label}</Badge>
            <div className="space-y-2 text-sm">
              <a href={`tel:${contact.phone_number}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" />{contact.phone_number}
              </a>
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0" />{contact.email}
                </a>
              )}
              {(contact as any).company && <p className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{(contact as any).company}</p>}
              {(contact as any).address && <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{(contact as any).address}</p>}
            </div>
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-secondary/30 rounded-lg p-2 text-center">
                <p className="font-bold text-base text-primary">{(contact as any).call_count ?? 0}</p>
                <p className="text-muted-foreground">Calls</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2 text-center">
                <p className="font-bold text-xs">{formatDate((contact as any).last_contacted) ?? "—"}</p>
                <p className="text-muted-foreground">Last Contact</p>
              </div>
            </div>
            {/* Status update */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pipeline Status</Label>
              <div className="space-y-1">
                {STATUSES.map((s) => (
                  <button key={s.id} onClick={() => onStatusChange(contact.id, s.id)}
                    className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-left",
                      (contact as any).status === s.id ? cn(s.color, "border-current") : "border-border/30 text-muted-foreground hover:bg-secondary/50")}>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />{s.label}
                    {(contact as any).status === s.id && <CheckCircle2 className="h-3 w-3 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CALLS */}
        {tab === "calls" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">{calls.length} call{calls.length !== 1 ? "s" : ""} found</p>
              <button onClick={() => { setLoadingCalls(true); listContactCalls(contact.id).then(d => setCalls(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingCalls(false)); }}
                className="p-1 rounded text-muted-foreground hover:text-foreground"><RefreshCw className="h-3 w-3" /></button>
            </div>
            {loadingCalls ? <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
              : calls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PhoneCall className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No calls found for this contact</p>
                </div>
              ) : calls.map((c) => (
                <div key={c.id} className="bg-secondary/20 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", c.status === "completed" ? "bg-green-400" : c.status === "failed" ? "bg-red-400" : "bg-yellow-400")} />
                      <span className="text-xs font-medium capitalize">{c.status ?? "unknown"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.started_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(c.duration_seconds)}</span>
                    {c.agent_name && <span className="flex items-center gap-1"><Bot className="h-3 w-3" />{c.agent_name}</span>}
                    {c.cost_usd != null && c.cost_usd > 0 && <span>${c.cost_usd.toFixed(3)}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    {c.call_from} → {c.call_to}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* SMS */}
        {tab === "sms" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingSMS ? <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
                : smsMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No messages yet</p>
                  </div>
                ) : smsMessages.map((m, i) => (
                  <div key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-xs",
                    m.direction === "outbound" ? "ml-auto bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary/50 text-foreground rounded-bl-sm")}>
                    <p>{m.message}</p>
                    <p className={cn("text-[10px] mt-0.5", m.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {formatDateTime(m.created_at)}
                    </p>
                  </div>
                ))}
              <div ref={smsEndRef} />
            </div>
            <div className="p-3 border-t border-border/30 flex gap-2">
              <Input value={smsText} onChange={(e) => setSmsText(e.target.value)}
                placeholder="Type a message…" className="text-xs h-8"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendSMS()} />
              <Button size="sm" onClick={handleSendSMS} disabled={sendingSMS || !smsText.trim()} className="h-8 px-3">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* EMAILS */}
        {tab === "emails" && (
          <div className="p-3 space-y-2">
            <Button size="sm" onClick={() => setShowEmailCompose(true)} className="w-full h-8 text-xs gap-1.5 mb-2">
              <Paperclip className="h-3.5 w-3.5" /> Compose Email
            </Button>
            {loadingEmails ? <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
              : emails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No emails logged yet</p>
                </div>
              ) : emails.map((e) => (
                <div key={e.id} className="bg-secondary/20 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                      e.direction === "outbound" ? "text-blue-400 border-blue-400/30" : "text-emerald-400 border-emerald-400/30")}>
                      {e.direction === "outbound" ? "Sent" : "Received"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{formatDate(e.created_at)}</span>
                  </div>
                  <p className="text-xs font-medium">{e.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{e.body}</p>
                </div>
              ))}
            {showEmailCompose && (
              <EmailModal contact={contact} onSend={handleSendEmail} onCancel={() => setShowEmailCompose(false)} sending={sendingEmail} />
            )}
          </div>
        )}

        {/* CALENDAR */}
        {tab === "calendar" && (
          <div className="p-3 space-y-2">
            <Button size="sm" onClick={() => { setEditApt(undefined); setShowAptModal(true); }} className="w-full h-8 text-xs gap-1.5 mb-2">
              <Plus className="h-3.5 w-3.5" /> Schedule Appointment
            </Button>
            {loadingApts ? <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
              : appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No appointments scheduled</p>
                </div>
              ) : appointments.map((a) => (
                <div key={a.id} className="bg-secondary/20 rounded-xl p-3 space-y-1 group">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium flex-1">{a.title}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditApt(a); setShowAptModal(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => handleDeleteApt(a.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-primary">{formatDateTime(a.start_time)}</p>
                  {a.location && <p className="text-[10px] text-muted-foreground">{a.location}</p>}
                  {a.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{a.description}</p>}
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                    a.status === "completed" ? "text-green-400 border-green-400/30" : "text-yellow-400 border-yellow-400/30")}>
                    {a.status}
                  </Badge>
                </div>
              ))}
            {showAptModal && (
              <AppointmentModal initial={editApt} contactId={contact.id} contacts={[contact]}
                onSave={handleSaveApt} onCancel={() => { setShowAptModal(false); setEditApt(undefined); }} saving={savingApt} />
            )}
          </div>
        )}

        {/* TASKS */}
        {tab === "tasks" && (
          <div className="p-3 space-y-2">
            <Button size="sm" onClick={() => setShowTaskModal(true)} className="w-full h-8 text-xs gap-1.5 mb-2">
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
            {loadingTasks ? <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
              : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No tasks yet</p>
                </div>
              ) : tasks.map((t) => (
                <div key={t.id} className={cn("flex items-start gap-2 bg-secondary/20 rounded-xl p-3", t.completed && "opacity-50")}>
                  <button onClick={() => handleToggleTask(t)} className="mt-0.5 shrink-0">
                    {t.completed ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium", t.completed && "line-through")}>{t.title}</p>
                    {t.due_date && <p className="text-[10px] text-muted-foreground">{formatDate(t.due_date)}</p>}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0",
                    t.priority === "high" ? "text-red-400 border-red-400/30"
                      : t.priority === "medium" ? "text-yellow-400 border-yellow-400/30"
                        : "text-slate-400 border-slate-400/30")}>
                    {t.priority}
                  </Badge>
                </div>
              ))}
            {showTaskModal && (
              <TaskModal contactId={contact.id} contacts={[contact]}
                onSave={handleSaveTask} onCancel={() => setShowTaskModal(false)} saving={savingTask} />
            )}
          </div>
        )}

        {/* NOTES */}
        {tab === "notes" && (
          <div className="p-3 space-y-3">
            <div className="flex gap-2">
              <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…"
                className="text-xs h-8" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddNote()} />
              <Button size="sm" onClick={handleAddNote} disabled={addingNote || !noteText.trim()} className="h-8 px-3 text-xs">Add</Button>
            </div>
            <div className="space-y-2">
              {loadingNotes ? <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
                : notes.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
                  : notes.map((n) => (
                    <div key={n.id} className="bg-secondary/20 rounded-xl px-3 py-2 text-xs space-y-1">
                      <p>{n.note}</p>
                      <p className="text-muted-foreground">{formatDate(n.created_at)}</p>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ contacts }: { contacts: Contact[] }) {
  const [today] = useState(new Date());
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editApt, setEditApt] = useState<Appointment | undefined>();
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    setLoading(true);
    listAllAppointments().then(d => setAppointments(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const aptsByDay = appointments.reduce((acc, a) => {
    const d = new Date(a.start_time).getDate();
    const m = new Date(a.start_time).getMonth();
    const y = new Date(a.start_time).getFullYear();
    if (m === month && y === year) {
      acc[d] = acc[d] ? [...acc[d], a] : [a];
    }
    return acc;
  }, {} as Record<number, Appointment[]>);

  const selectedApts = selectedDay ? (aptsByDay[selectedDay.getDate()] ?? []) : [];

  const handleSaveApt = async (cid: number, data: Omit<Appointment, "id">) => {
    setSaving(true);
    try {
      if (editApt && editApt.contact_id) {
        await updateContactAppointment(editApt.contact_id, editApt.id, data);
        setAppointments((prev) => prev.map((a) => a.id === editApt.id ? { ...a, ...data } : a));
        toast({ title: "Updated" });
      } else {
        const apt = await createContactAppointment(cid, data);
        setAppointments((prev) => [...prev, { ...apt, contact_id: cid }]);
        toast({ title: "Appointment scheduled" });
      }
      setShowModal(false); setEditApt(undefined);
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (a: Appointment) => {
    if (!a.contact_id || !confirm("Delete?")) return;
    try {
      await deleteContactAppointment(a.contact_id, a.id);
      setAppointments((prev) => prev.filter((x) => x.id !== a.id));
      setSelectedDay(null);
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Google Calendar</h1>
            <p className="text-xs text-muted-foreground">{MONTHS[month]} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-secondary/50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-medium text-sm w-28 text-center">{MONTHS[month]} {year}</span>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-secondary/50"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <select className="h-8 rounded-md border border-input bg-background/50 px-2 text-xs text-muted-foreground">
          <option>No calendars found</option>
        </select>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Sync Google
        </Button>
        <Button size="sm" onClick={() => { setEditApt(undefined); setShowModal(true); }} className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Schedule
        </Button>
      </div>

      {/* Google Calendar connect banner — always visible */}
      <div className="mx-4 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col md:flex-row items-start md:items-center gap-4 shrink-0">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-amber-400">Your Google Calendar is not yet connected!</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 mt-2">
            {[
              "Import all of your Google calendars and events.",
              "Keep your Google color scheme and settings.",
              "View, create, edit, and reschedule events.",
              "Automatically assign leads to events.",
              "Receive popup reminders for upcoming events.",
              "View all events for a lead on the same page.",
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-amber-400 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
        <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-600 text-white shrink-0" onClick={() => window.open("/api/google/auth", "_blank")}>
          <Calendar className="h-3.5 w-3.5" /> Connect Google Calendar
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {loading ? <p className="text-center text-muted-foreground text-sm py-12">Loading…</p> : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map((d) => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                  const dayApts = aptsByDay[day] ?? [];
                  const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month && selectedDay?.getFullYear() === year;
                  return (
                    <button key={day} onClick={() => setSelectedDay(isSelected ? null : new Date(year, month, day))}
                      className={cn("min-h-[80px] rounded-xl p-2 text-left border transition-all",
                        isSelected ? "bg-primary/10 border-primary/30" : isToday ? "bg-primary/5 border-primary/20" : "bg-secondary/20 border-border/20 hover:bg-secondary/40")}>
                      <span className={cn("text-xs font-medium", isToday ? "text-primary font-bold" : "text-foreground")}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayApts.slice(0, 2).map((a) => (
                          <div key={a.id} className="bg-primary/20 text-primary text-[10px] rounded px-1 py-0.5 truncate">{a.title}</div>
                        ))}
                        {dayApts.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayApts.length - 2} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Day detail sidebar */}
        {selectedDay && (
          <div className="w-64 border-l border-border/30 p-4 overflow-y-auto shrink-0">
            <p className="text-sm font-semibold mb-3">{selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            {selectedApts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No appointments</p>
            ) : (
              <div className="space-y-2">
                {selectedApts.map((a) => (
                  <div key={a.id} className="bg-secondary/30 rounded-xl p-3 space-y-1 group">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-medium flex-1">{a.title}</p>
                      <button onClick={() => handleDelete(a)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <p className="text-[10px] text-primary">{formatDateTime(a.start_time)}</p>
                    {a.first_name && <p className="text-[10px] text-muted-foreground">{a.first_name} {a.last_name}</p>}
                    {a.location && <p className="text-[10px] text-muted-foreground">{a.location}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AppointmentModal contactId={undefined} contacts={contacts}
          initial={editApt} onSave={handleSaveApt} onCancel={() => { setShowModal(false); setEditApt(undefined); }} saving={saving} />
      )}
    </div>
  );
}

// ── Calls View ─────────────────────────────────────────────────────────────────

function CallsView() {
  const [calls, setCalls] = useState<CRMCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadCalls = useCallback(() => {
    setLoading(true);
    listCRMCalls().then(d => setCalls(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this call log?")) return;
    setDeleting(id);
    try {
      await deleteCRMCall(id);
      setCalls(prev => prev.filter(c => c.id !== id));
      toast({ title: "Call log deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div>
          <h1 className="text-xl font-bold">CRM Call Logs</h1>
          <p className="text-xs text-muted-foreground">{calls.length} total calls logged</p>
        </div>
        <button onClick={loadCalls} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? <p className="text-center text-muted-foreground text-sm py-12">Loading calls…</p>
          : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <PhoneCall className="h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm font-medium">No CRM calls logged yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Calls you log against contacts will appear here</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1.2fr_0.5fr] gap-4 px-4 pb-1 text-xs font-medium text-muted-foreground border-b border-border/20">
                <span>Contact</span><span>Phone</span><span>Direction</span><span>Duration</span><span>Date</span><span></span>
              </div>
              {calls.map((c) => (
                <div key={c.id} className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1.2fr_0.5fr] gap-4 px-4 py-3 rounded-xl bg-card/40 border border-border/20 text-sm items-center hover:bg-secondary/20 transition-colors">
                  <div>
                    <p className="text-xs font-medium">{c.contact_name ?? "Unknown"}</p>
                    {c.notes && <p className="text-[10px] text-muted-foreground truncate">{c.notes}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{c.phone_number ?? "—"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full shrink-0",
                      c.direction === "inbound" ? "bg-blue-400" : "bg-green-400")} />
                    <span className="text-xs capitalize">{c.direction}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full shrink-0",
                      c.status === "completed" ? "bg-green-400" : c.status === "no_answer" ? "bg-red-400" : "bg-yellow-400")} />
                    <span className="text-xs">{formatDuration(c.duration_seconds)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(c.called_at)}</span>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {deleting === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Tasks View ────────────────────────────────────────────────────────────────

function TasksView({ contacts }: { contacts: Contact[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");

  const load = useCallback(() => {
    setLoading(true);
    listAllTasks().then(d => setTasks(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : filter === "pending" ? !t.completed : t.completed
  );

  const handleToggle = async (t: Task) => {
    try {
      await updateTask(t.id, { ...t, completed: !t.completed });
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, completed: !x.completed } : x));
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const handleSave = async (cid: number, data: Omit<Task, "id" | "completed">) => {
    if (!cid) { toast({ title: "Select a contact", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const t = await createContactTask(cid, data);
      setTasks((prev) => [{ ...t, contact_id: cid, first_name: contacts.find(c => c.id === cid)?.first_name }, ...prev]);
      setShowModal(false);
      toast({ title: "Task created" });
    } catch { toast({ title: "Failed to create task", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const pending = tasks.filter((t) => !t.completed).length;
  const high = tasks.filter((t) => !t.completed && t.priority === "high").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div>
          <h1 className="text-xl font-bold">Tasks</h1>
          <p className="text-xs text-muted-foreground">{pending} pending · {high} high priority</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border/20 bg-background/20 shrink-0">
        {(["pending", "all", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
              filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40")}>
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <p className="text-center text-muted-foreground text-sm py-12">Loading…</p>
          : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ClipboardList className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">No {filter !== "all" ? filter : ""} tasks</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((t) => (
                <div key={t.id} className={cn("flex items-center gap-3 p-3 rounded-xl border bg-card/40 border-border/20 hover:bg-secondary/20 transition-colors group", t.completed && "opacity-50")}>
                  <button onClick={() => handleToggle(t)} className="shrink-0">
                    {t.completed ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", t.completed && "line-through text-muted-foreground")}>{t.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {(t.first_name || t.last_name) && <span>{t.first_name} {t.last_name}</span>}
                      {t.due_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(t.due_date)}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-xs px-2 shrink-0",
                    t.priority === "high" ? "text-red-400 border-red-400/30"
                      : t.priority === "medium" ? "text-yellow-400 border-yellow-400/30"
                        : "text-slate-400 border-slate-400/30")}>
                    {t.priority}
                  </Badge>
                  <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>

      {showModal && (
        <TaskModal contacts={contacts} onSave={handleSave} onCancel={() => setShowModal(false)} saving={saving} />
      )}
    </div>
  );
}

// ── Dashboard View ────────────────────────────────────────────────────────────

function DashboardView({ contacts }: { contacts: Contact[] }) {
  const total = contacts.length;
  const closed = contacts.filter((c) => (c as any).status === "closed_won").length;
  const interested = contacts.filter((c) => (c as any).status === "interested").length;
  const newLeads = contacts.filter((c) => (c as any).status === "new_lead").length;
  const convRate = total > 0 ? ((closed / total) * 100).toFixed(1) : "0.0";

  const recentContacts = [...contacts].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  const callbackContacts = contacts.filter((c) => (c as any).status === "callback").slice(0, 5);

  const stats = [
    { label: "Total Contacts", value: total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "New Leads", value: newLeads, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    { label: "Interested", value: interested, icon: Star, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Closed Won", value: closed, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: "Conv. Rate", value: `${convRate}%`, icon: BarChart2, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Need Callback", value: contacts.filter((c) => (c as any).status === "callback").length, icon: Phone, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">CRM overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={cn("rounded-xl border p-4 space-y-2", s.bg)}>
            <s.icon className={cn("h-5 w-5", s.color)} />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline breakdown */}
      <div className="rounded-xl border border-border/30 bg-card/40 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /> Pipeline</h2>
        <div className="space-y-2">
          {STATUSES.map((s) => {
            const count = contacts.filter((c) => (c as any).status === s.id).length;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />
                <span className="text-xs w-28 shrink-0">{s.label}</span>
                <div className="flex-1 bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent contacts */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Contacts</h2>
          <div className="space-y-2">
            {recentContacts.map((c) => {
              const sm = statusMeta((c as any).status);
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">{initials(c)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fullName(c)}</p>
                    <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                  </div>
                  <Badge className={cn("text-[10px] px-1.5 border shrink-0", sm.color)}>{sm.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Need callback */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Phone className="h-4 w-4 text-yellow-400" /> Need Callback</h2>
          {callbackContacts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No callbacks scheduled</p>
          ) : (
            <div className="space-y-2">
              {callbackContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center text-xs font-bold text-yellow-400 shrink-0">{initials(c)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fullName(c)}</p>
                    <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                  </div>
                  <a href={`tel:${c.phone_number}`} className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pipeline (Kanban) View ────────────────────────────────────────────────────

function PipelineView({ contacts, onStatusChange, onEdit, onDelete }: {
  contacts: Contact[];
  onStatusChange: (id: number, status: string) => Promise<void>;
  onEdit: (c: Contact) => void;
  onDelete: (id: number) => void;
}) {
  const [selected, setSelected] = useState<Contact | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Columns3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sales Pipeline</h1>
            <p className="text-xs text-muted-foreground">{contacts.length} contacts across {STATUSES.length} stages</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Call Scripts
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Stage
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Kanban board */}
        <div className="flex gap-3 overflow-x-auto p-4 flex-1">
          {STATUSES.map((status) => {
            const cols = contacts.filter((c) => (c as any).status === status.id);
            return (
              <div key={status.id} className="w-60 shrink-0 flex flex-col gap-2">
                {/* Column header */}
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold", status.color)}>
                  <span className={cn("w-2 h-2 rounded-full shrink-0", status.dot)} />
                  <span className="flex-1">{status.label}</span>
                  <span className="bg-white/10 rounded-full px-2 py-0.5">{cols.length}</span>
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-[200px] max-h-[calc(100vh-200px)]">
                  {cols.map((c) => (
                    <div key={c.id}
                      onClick={() => setSelected(selected?.id === c.id ? null : c)}
                      className={cn("bg-card/60 border border-border/30 rounded-xl p-3 cursor-pointer hover:bg-secondary/30 hover:border-border/60 transition-all group",
                        selected?.id === c.id && "border-primary/30 bg-primary/5")}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">{initials(c)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fullName(c)}</p>
                          {c.company && <p className="text-[10px] text-muted-foreground truncate">{c.company}</p>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone_number}</p>
                        {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</p>}
                      </div>
                      {/* Quick move */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {STATUSES.filter(s => s.id !== status.id).slice(0, 3).map(s => (
                          <button key={s.id} onClick={() => onStatusChange(c.id, s.id)}
                            title={`Move to ${s.label}`}
                            className={cn("flex-1 text-[9px] rounded-lg py-1 border truncate transition-colors", s.color)}>
                            → {s.label.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {cols.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/20 rounded-xl">
                      <p className="text-xs text-muted-foreground/50">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact detail side panel when selected */}
        {selected && (
          <div className="w-80 shrink-0 border-l border-border/30 overflow-hidden">
            <DetailPanel contact={selected} contacts={contacts}
              onClose={() => setSelected(null)}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Pulse View ──────────────────────────────────────────────────────────────

type PulseAction = "call" | "text" | "email";
type LeadResult = { status: "idle" | "running" | "success" | "failed"; message?: string };

function PowerDialerView({ contacts, onStatusChange }: {
  contacts: Contact[];
  onStatusChange: (id: number, status: string) => Promise<void>;
}) {
  const queue = contacts.filter(c =>
    ["new_lead", "callback", "interested"].includes((c as any).status ?? "")
  );

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allSelected = queue.length > 0 && queue.every(c => selectedIds.has(c.id));
  const toggleLead  = (id: number) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll   = () => setSelectedIds(allSelected ? new Set() : new Set(queue.map(c => c.id)));

  // Channel
  const [action, setAction] = useState<PulseAction>("call");

  // Call — prompt
  const allPrompts = loadPrompts();
  const [selectedPromptId, setSelectedPromptId] = useState<string>(() => getActivePromptId() ?? "");
  const selectedPrompt = allPrompts.find(p => p.id === selectedPromptId) ?? null;
  // Agent comes from the phone number attached to the selected CRM prompt
  const agentId: number | null = selectedPrompt?.agentId ?? null;

  // Text / Email — message
  const [smsMessage, setSmsMessage]       = useState("");
  const [emailSubject, setEmailSubject]   = useState("");
  const [emailBody, setEmailBody]         = useState("");
  const [generatingMsg, setGeneratingMsg] = useState(false);

  // Launch state — per-lead result tracking
  const [launching, setLaunching] = useState(false);
  const [results, setResults]     = useState<Record<number, LeadResult>>({});
  const setResult = (id: number, r: LeadResult) => setResults(prev => ({ ...prev, [id]: r }));

  const handleReset = () => {
    setSelectedIds(new Set()); setResults({}); setLaunching(false);
  };

  const canLaunch = selectedIds.size > 0 && (
    action === "call"  ? !!selectedPrompt :
    action === "text"  ? !!smsMessage.trim() :
    !!emailSubject.trim() && !!emailBody.trim()
  );

  const generateAIMessage = async () => {
    setGeneratingMsg(true);
    try {
      const result = await generateAIPromptAdvanced({
        business_name: "My Business", business_type: "general",
        call_direction: "outbound",
        special_instructions: action === "text"
          ? "Write a short, friendly outbound SMS (max 160 chars) to introduce our service and invite a reply."
          : "Write a concise outbound sales email with a subject line and a brief body (3-4 sentences).",
        assistant_name: "", hours: "", phone_number: "", address: "",
      });
      const text = (result as any).prompt ?? "";
      if (action === "text") {
        setSmsMessage(text.slice(0, 160));
      } else {
        const lines = text.split("\n").filter(Boolean);
        setEmailSubject(lines[0] ?? "Follow up");
        setEmailBody(lines.slice(1).join("\n").trim() || text);
      }
    } catch (err: any) { toast({ title: "AI generation failed", description: err.message, variant: "destructive" }); }
    finally { setGeneratingMsg(false); }
  };

  const handleLaunch = async () => {
    if (!canLaunch) return;
    setLaunching(true);
    const targets = queue.filter(c => selectedIds.has(c.id));
    // init all to running
    targets.forEach(c => setResult(c.id, { status: "running" }));

    await Promise.allSettled(targets.map(async c => {
      try {
        if (action === "call") {
          // Pass system_prompt directly — backend pushes it to the agent before calling
          await initiateOutboundCall({
            agent_id: agentId ?? undefined,
            to_number: c.phone_number,
            contact_name: fullName(c),
            system_prompt: selectedPrompt?.content ?? undefined,
          });
        } else if (action === "text") {
          await sendContactSMS(c.id, smsMessage);
        } else {
          await addContactEmail(c.id, { subject: emailSubject, body: emailBody, direction: "outbound", to_address: c.email ?? undefined });
        }
        setResult(c.id, { status: "success" });
      } catch (err: any) {
        setResult(c.id, { status: "failed", message: err.message });
      }
    }));

    const succeeded = targets.filter(c => results[c.id]?.status === "success").length;
    toast({ title: `AI Pulse complete`, description: `${targets.length} leads reached via ${action}` });
    setLaunching(false);
  };

  const actionMeta: Record<PulseAction, { label: string; icon: React.ElementType; color: string; activeColor: string }> = {
    call:  { label: "Call",  icon: Phone,        color: "text-green-400",  activeColor: "border-green-500 bg-green-500/5"  },
    text:  { label: "Text",  icon: MessageSquare, color: "text-blue-400",   activeColor: "border-blue-500 bg-blue-500/5"   },
    email: { label: "Email", icon: Mail,          color: "text-purple-400", activeColor: "border-purple-500 bg-purple-500/5"},
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Rocket className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI Pulse</h1>
            <p className="text-xs text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} lead${selectedIds.size > 1 ? "s" : ""} selected` : `${queue.length} in queue`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleReset} className="h-8 text-xs">Reset</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ─── Left panel ─── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border/30">

          {/* Channel tabs */}
          <div className="flex gap-2 px-5 pt-4 pb-0 shrink-0">
            {(["call", "text", "email"] as PulseAction[]).map(a => {
              const m = actionMeta[a];
              return (
                <button key={a} onClick={() => setAction(a)}
                  className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                    action === a ? m.activeColor : "border-transparent hover:bg-secondary/40 text-muted-foreground")}>
                  <m.icon className={cn("h-4 w-4", action === a ? m.color : "")} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Channel config */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {action === "call" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">AI will call each selected lead using the prompt below. All calls fire simultaneously.</p>
                <div className={cn("rounded-xl border-2 p-4 space-y-3 transition-colors",
                  selectedPrompt ? "border-primary/30 bg-primary/5" : "border-yellow-500/40 bg-yellow-500/5")}>
                  <div className="flex items-center gap-2">
                    <BotMessageSquare className={cn("h-4 w-4 shrink-0", selectedPrompt ? "text-primary" : "text-yellow-400")} />
                    <span className={cn("text-xs font-semibold", selectedPrompt ? "text-foreground" : "text-yellow-400")}>
                      {selectedPrompt ? "AI Prompt selected" : "Select a prompt"}
                    </span>
                    {!selectedPrompt && <AlertCircle className="h-3.5 w-3.5 text-yellow-400 ml-auto" />}
                  </div>
                  {allPrompts.length === 0
                    ? <p className="text-[11px] text-yellow-400/80">No prompts yet — go to <strong>My Prompt</strong> and create one first.</p>
                    : <select value={selectedPromptId} onChange={e => setSelectedPromptId(e.target.value)}
                        className={cn("w-full rounded-lg border px-3 h-9 text-sm bg-background/60 focus:outline-none",
                          selectedPrompt ? "border-primary/30" : "border-yellow-500/30 text-yellow-400")}>
                        <option value="">— choose a prompt —</option>
                        {allPrompts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.direction})</option>)}
                      </select>
                  }
                  {selectedPrompt && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedPrompt.direction === "outbound" ? "📞 Outbound" : "📥 Inbound"} · {selectedPrompt.content?.slice(0, 80) ?? "No content"}…
                    </p>
                  )}
                </div>
              </div>
            )}

            {action === "text" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">AI will send this SMS to each selected lead at the same time.</p>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Message</Label>
                  <button onClick={generateAIMessage} disabled={generatingMsg}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50">
                    {generatingMsg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate with AI
                  </button>
                </div>
                <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value.slice(0, 160))}
                  placeholder="Hi [name], this is [company] — just reaching out to..."
                  className="w-full h-32 rounded-xl border border-border/40 bg-background/50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <p className="text-[10px] text-muted-foreground text-right">{smsMessage.length}/160 chars</p>
              </div>
            )}

            {action === "email" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">AI will send this email to each selected lead simultaneously.</p>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email</Label>
                  <button onClick={generateAIMessage} disabled={generatingMsg}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50">
                    {generatingMsg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate with AI
                  </button>
                </div>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Subject line…" className="h-9 text-sm" />
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  placeholder="Email body…"
                  className="w-full h-36 rounded-xl border border-border/40 bg-background/50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            )}

            {/* Launch button */}
            <button
              disabled={!canLaunch || launching}
              onClick={handleLaunch}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all",
                canLaunch && !launching
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-secondary/30 border border-border/30 text-muted-foreground cursor-not-allowed opacity-50"
              )}>
              {launching
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Launching…</>
                : <><Rocket className="h-5 w-5" />
                    {selectedIds.size > 0
                      ? `Launch AI ${action === "call" ? "Call" : action === "text" ? "Text" : "Email"} → ${selectedIds.size} lead${selectedIds.size > 1 ? "s" : ""}`
                      : `Select leads to launch`}
                  </>}
            </button>

            {/* Progress bar */}
            {Object.keys(results).length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Launch Progress</p>
                {queue.filter(c => results[c.id]).map(c => {
                  const r = results[c.id];
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{initials(c)}</div>
                      <span className="text-xs flex-1 truncate">{fullName(c)}</span>
                      {r.status === "running"  && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
                      {r.status === "success"  && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                      {r.status === "failed"   && <X className="h-3.5 w-3.5 text-destructive shrink-0" title={r.message} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right panel — multi-select lead list ─── */}
        <div className="w-72 flex flex-col shrink-0">
          {/* Select all header */}
          <div className="px-4 py-3 border-b border-border/20 bg-card/20 flex items-center gap-3">
            <button onClick={toggleAll}
              className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                allSelected ? "bg-primary border-primary" : "border-border/60 hover:border-primary/60")}>
              {allSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{allSelected ? "Deselect All" : "Select All"}</p>
              <p className="text-xs text-muted-foreground">{queue.length} leads · {selectedIds.size} selected</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {queue.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">No leads in queue.<br />Add contacts with New Lead, Callback, or Interested status.</p>
            )}
            {queue.map(c => {
              const csm = statusMeta((c as any).status);
              const isSelected = selectedIds.has(c.id);
              const res = results[c.id];
              return (
                <button key={c.id} onClick={() => toggleLead(c.id)}
                  className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                    isSelected ? "bg-primary/10 border border-primary/25" : "bg-secondary/20 hover:bg-secondary/40 border border-transparent")}>
                  {/* Checkbox */}
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                    isSelected ? "bg-primary border-primary" : "border-border/50")}>
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {initials(c)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{fullName(c)}</p>
                    <Badge className={cn("text-[9px] px-1 border mt-0.5", csm.color)}>{csm.label}</Badge>
                  </div>
                  {/* Result indicator */}
                  {res?.status === "running"  && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
                  {res?.status === "success"  && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                  {res?.status === "failed"   && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reports View ──────────────────────────────────────────────────────────────

function ReportsView({ contacts }: { contacts: Contact[] }) {
  const [calls, setCalls] = useState<CRMCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "custom">("week");

  useEffect(() => {
    listCRMCalls().then(d => setCalls(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingCalls(false));
  }, []);

  const total = contacts.length;
  const closedWon = contacts.filter(c => (c as any).status === "closed_won").length;
  const closedLost = contacts.filter(c => (c as any).status === "closed_lost").length;
  const convRate = total > 0 ? ((closedWon / total) * 100).toFixed(1) : "0.0";
  const totalCallMin = calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const completedCalls = calls.filter(c => c.status === "completed").length;
  const inboundCalls = calls.filter(c => c.direction === "inbound").length;
  const outboundCalls = calls.filter(c => c.direction === "outbound").length;

  const sourceBreakdown = SOURCES.map(src => ({
    label: src,
    count: contacts.filter(c => (c as any).source === src).length,
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

  const maxSource = Math.max(...sourceBreakdown.map(s => s.count), 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="flex-1">
          <h1 className="text-xl font-bold">My Analytics</h1>
          <p className="text-xs text-muted-foreground">Performance overview</p>
        </div>
        {/* Time range selector */}
        <div className="flex gap-1 bg-secondary/40 rounded-lg p-1">
          {(["day", "week", "month", "custom"] as const).map(t => (
            <button key={t} onClick={() => setTimeRange(t)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium uppercase transition-all",
                timeRange === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Leads", value: total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "Closed Won", value: closedWon, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Conversion Rate", value: `${convRate}%`, icon: Target, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
              { label: "Total Calls", value: completedCalls, icon: PhoneCall, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
            ].map(s => (
              <div key={s.label} className={cn("rounded-xl border p-4 space-y-2", s.bg)}>
                <s.icon className={cn("h-5 w-5", s.color)} />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* AI Pulse Report */}
          <ReportCard title="AI Pulse Report" icon={<Rocket className="h-5 w-5 text-primary" />} iconBg="bg-primary/15"
            timeRange={timeRange} setTimeRange={setTimeRange}
            extra={<select className="h-7 rounded-lg border border-border/40 bg-background/50 px-2 text-xs text-muted-foreground"><option>Select campaigns</option></select>}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground border-b border-border/20">
                  {["Type","Target","Status","Leads reached","Carrier violations","Response rate","Avg response time"].map(h => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody><tr className="text-muted-foreground/70">
                  <td className="py-2 pr-4">Totals</td><td className="pr-4">—</td><td className="pr-4">—</td>
                  <td className="pr-4">0</td><td className="pr-4">0</td><td className="pr-4">0%</td><td>—</td>
                </tr></tbody>
              </table>
            </div>
          </ReportCard>

          {/* Drip Marketing Analytics */}
          <ReportCard title="Drip Marketing Analytics" icon={<BarChart3 className="h-5 w-5 text-purple-400" />} iconBg="bg-purple-500/15"
            timeRange={timeRange} setTimeRange={setTimeRange} downloadCsv>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground border-b border-border/20">
                  {["Type","Target","Status","Leads reached","Carrier violations","Response rate","Avg response time"].map(h => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody><tr><td colSpan={7} className="py-6 text-center text-muted-foreground/60 text-xs">No campaigns found</td></tr></tbody>
              </table>
            </div>
          </ReportCard>

          {/* Outbound/Inbound Texts & Call Stats — side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReportCard title="Outbound & Inbound Texts" icon={<MessageSquare className="h-5 w-5 text-blue-400" />} iconBg="bg-blue-500/15"
              timeRange={timeRange} setTimeRange={setTimeRange} showTable>
              <CSSLineChart legend={[{label:"Outbound texts",color:"bg-teal-400"},{label:"Inbound texts",color:"bg-emerald-400"}]}
                data={calls} dateKey="called_at" />
            </ReportCard>
            <ReportCard title="Call Statistics" icon={<PhoneCall className="h-5 w-5 text-purple-400" />} iconBg="bg-purple-500/15"
              timeRange={timeRange} setTimeRange={setTimeRange} showTable>
              <CSSLineChart legend={[{label:"Outbound calls",color:"bg-teal-400"},{label:"Inbound calls",color:"bg-emerald-400"}]}
                data={calls} dateKey="called_at" />
            </ReportCard>
          </div>

          {/* Lead sources / Pipeline breakdown side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReportCard title="Leads By Vendor" icon={<TrendingUp className="h-5 w-5 text-orange-400" />} iconBg="bg-orange-500/15"
              timeRange={timeRange} setTimeRange={setTimeRange}>
              {sourceBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No source data yet</p>
              ) : sourceBreakdown.map(s => (
                <div key={s.label} className="mb-2">
                  <div className="flex justify-between mb-0.5"><span className="text-xs">{s.label}</span><span className="text-xs text-muted-foreground">{s.count}</span></div>
                  <div className="h-2 bg-secondary/40 rounded-full overflow-hidden"><div className="h-full bg-purple-500/60 rounded-full" style={{width:`${(s.count/maxSource)*100}%`}} /></div>
                </div>
              ))}
            </ReportCard>
            <ReportCard title="Sales Pipeline Stats" icon={<BarChart2 className="h-5 w-5 text-primary" />} iconBg="bg-primary/15"
              timeRange={timeRange} setTimeRange={setTimeRange} showTable
              extra={<select className="h-7 rounded-lg border border-border/40 bg-background/50 px-2 text-xs text-muted-foreground"><option>Select folders</option></select>}>
              {STATUSES.map(s => {
                const count = contacts.filter(c => (c as any).status === s.id).length;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={s.id} className="mb-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5"><span className={cn("w-2 h-2 rounded-full",s.dot)}/><span className="text-xs">{s.label}</span></div>
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 bg-secondary/40 rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full" style={{width:`${pct}%`}} /></div>
                  </div>
                );
              })}
            </ReportCard>
          </div>

          {/* Master Switch History */}
          <ReportCard title="Master Switch History" icon={<Activity className="h-5 w-5 text-green-400" />} iconBg="bg-green-500/15"
            timeRange={timeRange} setTimeRange={setTimeRange} downloadCsv active>
            <div className="flex items-center justify-center py-8 text-muted-foreground/60 text-xs gap-2">
              <AlertCircle className="h-4 w-4" /> No results found.
            </div>
          </ReportCard>

          {/* Rejected Leads */}
          <ReportCard title="Rejected Leads" icon={<Users className="h-5 w-5 text-red-400" />} iconBg="bg-red-500/15"
            timeRange={timeRange} setTimeRange={setTimeRange} downloadCsv>
            <div className="flex items-center justify-center py-8 text-muted-foreground/60 text-xs gap-2">
              <AlertCircle className="h-4 w-4" /> No results found.
            </div>
          </ReportCard>

          {/* Win / Loss */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-4">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4" /> Win / Loss</h2>
            <div className="space-y-3">
              {[
                {label:`Won (${closedWon})`,pct:total>0?(closedWon/total)*100:0,color:"bg-green-500/60",text:"text-green-400"},
                {label:`Lost (${closedLost})`,pct:total>0?(closedLost/total)*100:0,color:"bg-red-500/60",text:"text-red-400"},
                {label:`In Progress (${total-closedWon-closedLost})`,pct:total>0?((total-closedWon-closedLost)/total)*100:0,color:"bg-blue-500/60",text:"text-blue-400"},
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1">
                    <span className={cn("text-xs font-medium",s.text)}>{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-secondary/40 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full",s.color)} style={{width:`${s.pct}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/20 text-xs text-muted-foreground/60">
            <div className="flex gap-4">
              <a href="#" className="hover:text-foreground">Terms of Service</a>
              <a href="#" className="hover:text-foreground">Privacy Policy</a>
            </div>
            <span>2026 © ISIBI.AI. All Rights Reserved.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable Report Card ──────────────────────────────────────────────────────

function ReportCard({ title, icon, iconBg, children, timeRange, setTimeRange, showTable, downloadCsv, extra, active }: {
  title: string; icon: React.ReactNode; iconBg: string; children: React.ReactNode;
  timeRange: string; setTimeRange: (t: any) => void;
  showTable?: boolean; downloadCsv?: boolean; extra?: React.ReactNode; active?: boolean;
}) {
  const [showTableState, setShowTableState] = useState(false);
  return (
    <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-4">
      <div className="flex items-center gap-3">
        {active !== undefined && (
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", active ? "bg-primary/80" : iconBg)}>{icon}</div>
        )}
        {active === undefined && <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>{icon}</div>}
        <h2 className="text-sm font-semibold flex-1">{title}</h2>
        {showTable && (
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
            <div onClick={() => setShowTableState(v => !v)}
              className={cn("w-8 h-4 rounded-full transition-colors relative", showTableState ? "bg-primary" : "bg-secondary/60")}>
              <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all", showTableState ? "left-4" : "left-0.5")} />
            </div>
            Show table
          </label>
        )}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {extra ?? <div />}
        <div className="flex items-center gap-2">
          {downloadCsv && (
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/30 text-xs text-muted-foreground hover:bg-secondary/40">
              <Download className="h-3 w-3" /> Download CSV
            </button>
          )}
          <div className="flex gap-0.5 bg-secondary/40 rounded-lg p-0.5">
            {(["day","week","month","custom"] as const).map(t => (
              <button key={t} onClick={() => setTimeRange(t)}
                className={cn("px-2.5 py-1 rounded-md text-[10px] font-medium uppercase transition-all",
                  timeRange === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── CSS Line Chart ────────────────────────────────────────────────────────────

function CSSLineChart({ legend, data, dateKey }: { legend: {label:string;color:string}[]; data: any[]; dateKey: string }) {
  const yLabels = [1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0];
  const today = new Date().toISOString().slice(0,10);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {legend.map(l => (<div key={l.label} className="flex items-center gap-1.5"><span className={cn("w-3 h-2 rounded",l.color)} />{l.label}</div>))}
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[10px] text-muted-foreground/60 pr-1" style={{height:140}}>
          {yLabels.map(y => <span key={y}>{y.toFixed(1)}</span>)}
        </div>
        <div className="flex-1 border border-border/20 rounded-lg bg-secondary/10 relative" style={{height:140}}>
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yLabels.slice(0,-1).map(y => <div key={y} className="border-t border-border/10" />)}
          </div>
          {data.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-center pb-2 text-[10px] text-muted-foreground/60">{today}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Campaigns View ────────────────────────────────────────────────────────────

function CampaignsView({ contacts }: { contacts: Contact[] }) {
  const [campaignTab, setCampaignTab] = useState<"create" | "past">("create");
  const [cDateFrom, setCDateFrom] = useState("");
  const [cDateTo, setCDateTo] = useState("");
  const [cSearch, setCSearch] = useState("");
  const [cPowerDialer, setCPowerDialer] = useState(false);
  const [searchResults, setSearchResults] = useState<Contact[] | null>(null);

  const handleSearch = () => {
    let results = contacts;
    if (cSearch) results = results.filter(c =>
      fullName(c).toLowerCase().includes(cSearch.toLowerCase()) ||
      c.phone_number.includes(cSearch) || c.email?.toLowerCase().includes(cSearch.toLowerCase())
    );
    if (cPowerDialer) results = results.filter(c => ["new_lead","callback"].includes((c as any).status ?? ""));
    if (cDateFrom) results = results.filter(c => new Date((c as any).created_at) >= new Date(cDateFrom));
    if (cDateTo) results = results.filter(c => new Date((c as any).created_at) <= new Date(cDateTo));
    setSearchResults(results);
  };

  const handleReset = () => { setCDateFrom(""); setCDateTo(""); setCSearch(""); setCPowerDialer(false); setSearchResults(null); };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold flex-1">Campaigns</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        {(["create","past"] as const).map(t => (
          <button key={t} onClick={() => setCampaignTab(t)}
            className={cn("px-8 py-3 text-sm font-medium border-b-2 transition-all uppercase tracking-wide",
              campaignTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "create" ? "Create Campaign" : "Past Campaigns"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {campaignTab === "create" ? (
          <div className="max-w-4xl space-y-6">
            <div className="rounded-xl border border-border/30 bg-card/40 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-base font-semibold">Create Campaign</h2>
              </div>
              <p className="text-sm text-muted-foreground">Campaigns allow you to bulk text and / or email your leads. Begin by specifying which leads you'd like to include in this campaign below.</p>
              <p className="text-xs text-muted-foreground/80">Leads that are blocked will not be included in campaigns.</p>

              {/* Filter form */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Leads from</label>
                  <div className="relative">
                    <Input type="date" value={cDateFrom} onChange={e => setCDateFrom(e.target.value)} className="h-8 text-xs pr-7" />
                    {cDateFrom && <button onClick={() => setCDateFrom("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Leads to</label>
                  <div className="relative">
                    <Input type="date" value={cDateTo} onChange={e => setCDateTo(e.target.value)} className="h-8 text-xs pr-7" />
                    {cDateTo && <button onClick={() => setCDateTo("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["Lead vendors","States","Time zones"].map(p => (
                  <div key={p} className="relative">
                    <select className="w-full h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm text-muted-foreground appearance-none">
                      <option>{p}</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select className="w-full h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm text-muted-foreground appearance-none">
                    <option>Only show</option>
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <div className="relative">
                  <select className="w-full h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm text-muted-foreground appearance-none">
                    <option>Disposition tags</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select className="w-full h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm text-muted-foreground appearance-none">
                    <option>Exclude disposition tags</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <Input value={cSearch} onChange={e => setCSearch(e.target.value)} placeholder="Enter name, phone number or email" className="h-9 text-sm" />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5"><X className="h-3.5 w-3.5" /> Reset</Button>
                <Button size="sm" onClick={handleSearch} className="gap-1.5"><Search className="h-3.5 w-3.5" /> Search</Button>
              </div>
            </div>

            {/* Results */}
            {searchResults !== null && (
              <div className="rounded-xl border border-border/30 bg-card/40 p-4">
                <p className="text-sm font-medium mb-3">Search results: {searchResults.length} leads</p>
                {searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No leads match your filters</p>
                ) : (
                  <div className="space-y-1.5">
                    {searchResults.slice(0, 20).map(c => {
                      const sm = statusMeta((c as any).status);
                      return (
                        <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">{initials(c)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fullName(c)}</p>
                            <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                          </div>
                          <Badge className={cn("text-[10px] px-1.5 border", sm.color)}>{sm.label}</Badge>
                        </div>
                      );
                    })}
                    {searchResults.length > 20 && <p className="text-xs text-muted-foreground text-center">+{searchResults.length - 20} more</p>}
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="flex justify-end mt-4 gap-2">
                    <Button size="sm" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Send SMS Campaign</Button>
                    <Button size="sm" variant="outline" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Send Email Campaign</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Send className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No past campaigns yet</p>
            <p className="text-xs mt-1">Create your first campaign to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Phone Setup View ──────────────────────────────────────────────────────────

function PhoneSetupView() {
  const [phoneTab, setPhoneTab] = useState<"numbers" | "business" | "compliance">("numbers");
  const [areaCode, setAreaCode]       = useState("");
  const [myNumbers, setMyNumbers]     = useState<PurchasedNumber[]>([]);
  const [available, setAvailable]     = useState<AvailableNumber[]>([]);
  const [loadingMy, setLoadingMy]     = useState(true);
  const [searching, setSearching]     = useState(false);
  const [purchasing, setPurchasing]   = useState<string | null>(null);
  const [releasing, setReleasing]     = useState<string | null>(null);

  const fetchMyNumbers = async () => {
    setLoadingMy(true);
    try { setMyNumbers(await getMyPhoneNumbers()); }
    catch { /* silent */ }
    finally { setLoadingMy(false); }
  };

  useEffect(() => { fetchMyNumbers(); }, []);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const nums = await searchAvailableNumbers("US", areaCode || undefined);
      setAvailable(nums);
      if (nums.length === 0) toast({ title: "No numbers found", description: "Try a different area code." });
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async (phone: string) => {
    setPurchasing(phone);
    try {
      await purchasePhoneNumber(phone);
      toast({ title: "Number purchased!", description: `${phone} — $1.15/mo` });
      setAvailable(prev => prev.filter(n => n.phone_number !== phone));
      fetchMyNumbers();
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(null);
    }
  };

  const handleRelease = async (phone: string) => {
    if (!confirm(`Release ${phone}? This cannot be undone.`)) return;
    setReleasing(phone);
    try {
      await releasePhoneNumber(phone);
      toast({ title: "Number released", description: phone });
      fetchMyNumbers();
    } catch (err: any) {
      toast({ title: "Release failed", description: err.message, variant: "destructive" });
    } finally {
      setReleasing(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
          <Phone className="h-5 w-5 text-green-400" />
        </div>
        <h1 className="text-lg font-bold flex-1">Phone Setup</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        {[
          { id: "numbers", label: "Phone Numbers" },
          { id: "business", label: "Business Profile" },
          { id: "compliance", label: "Compliance" },
        ].map(t => (
          <button key={t.id} onClick={() => setPhoneTab(t.id as any)}
            className={cn("px-8 py-3 text-sm font-medium border-b-2 transition-all uppercase tracking-wide",
              phoneTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-5xl">
        {phoneTab === "numbers" && (
          <>
            {/* Search & Purchase */}
            <div className="rounded-xl border border-border/30 bg-card/40 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                  <Search className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Find a Phone Number</h2>
                  <p className="text-xs text-muted-foreground">Search available US numbers and purchase instantly.</p>
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Area Code (optional)</label>
                  <Input
                    placeholder="e.g. 212, 310, 415 — leave blank for any"
                    value={areaCode}
                    onChange={e => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    className="h-9 text-sm"
                    maxLength={3}
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching} className="h-9 gap-2">
                  {searching
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Searching…</>
                    : <><Search className="h-4 w-4" /> Find Numbers</>}
                </Button>
              </div>

              {/* Available results */}
              {available.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{available.length} numbers available</p>
                  {available.map((num, i) => (
                    <div key={num.phone_number ?? i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Phone className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{num.phone_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {[num.region, num.country].filter(Boolean).join(", ") || "US"} ·{" "}
                            <span className="text-primary font-medium">$1.15/mo</span>
                          </p>
                        </div>
                      </div>
                      <Button size="sm" disabled={purchasing === num.phone_number} onClick={() => handlePurchase(num.phone_number)} className="gap-1.5">
                        {purchasing === num.phone_number
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <><Download className="h-3.5 w-3.5" /> Purchase</>}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Numbers */}
            <div className="rounded-xl border border-border/30 bg-card/40 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">My Phone Numbers</h2>
                    <p className="text-xs text-muted-foreground">{myNumbers.length} number{myNumbers.length !== 1 ? "s" : ""} owned</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMyNumbers} disabled={loadingMy} className="gap-1.5">
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingMy && "animate-spin")} /> Refresh
                </Button>
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Active — sending & receiving</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Inactive — receive only</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Default — used when no state match</span>
              </div>

              {loadingMy ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading numbers…
                </div>
              ) : myNumbers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground/60">
                  <Phone className="h-8 w-8" />
                  <p className="text-sm">No phone numbers yet.</p>
                  <p className="text-xs">Search above to purchase your first number.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myNumbers.map((num, i) => (
                    <div key={num.twilio_sid ?? num.phone_number ?? i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <Phone className="h-3.5 w-3.5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{num.phone_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {num.agent_name ? `→ ${num.agent_name}` : "Unassigned"}
                            {num.purchased_at ? ` · Purchased ${new Date(num.purchased_at).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs border border-green-500/30 text-green-400 bg-green-500/10">Active</Badge>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                          onClick={() => handleRelease(num.phone_number)}
                          disabled={releasing === num.phone_number}
                          title="Release number"
                        >
                          {releasing === num.phone_number
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {phoneTab === "business" && (
          <div className="rounded-xl border border-border/30 bg-card/40 p-6 space-y-4">
            <h2 className="text-base font-semibold">Business Profile</h2>
            <p className="text-sm text-muted-foreground">Set up your business profile for SMS compliance and branded calling.</p>
            <div className="grid grid-cols-2 gap-3">
              {["Business Name","Business Website","Business Type","EIN / Tax ID","Business Address","Contact Email"].map(f => (
                <div key={f} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{f}</label>
                  <Input placeholder={f} className="h-8 text-sm" />
                </div>
              ))}
            </div>
            <Button size="sm">Save Business Profile</Button>
          </div>
        )}

        {phoneTab === "compliance" && (
          <div className="rounded-xl border border-border/30 bg-card/40 p-6 space-y-4">
            <h2 className="text-base font-semibold">Compliance</h2>
            <div className="space-y-3">
              {[
                { title: "A2P 10DLC Registration", status: "Pending", desc: "Required for sending SMS messages in the US." },
                { title: "SHAKEN/STIR", status: "Not configured", desc: "Reduces spam flagging on outbound calls." },
                { title: "SMS Company Name", status: "Submitted", desc: "Displayed to recipients when receiving your texts." },
              ].map(c => (
                <div key={c.title} className="flex items-start gap-4 p-4 rounded-xl bg-secondary/20">
                  <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                  <Badge className="text-xs border border-yellow-500/30 text-yellow-400 bg-yellow-500/10 shrink-0">{c.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inbox View ────────────────────────────────────────────────────────────────

function InboxView({ contacts, onStatusChange, onEdit, onDelete }: {
  contacts: Contact[];
  onStatusChange: (id: number, status: string) => Promise<void>;
  onEdit: (c: Contact) => void;
  onDelete: (id: number) => void;
}) {
  const [inboxTab, setInboxTab] = useState<"received" | "scheduled" | "sent" | "rejected">("received");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [msgType, setMsgType] = useState<"sms" | "email">("sms");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [showBlocked, setShowBlocked] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const pagedContacts = contacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(contacts.length / PER_PAGE);

  const toggleCheck = (id: number) => setCheckedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = pagedContacts.length > 0 && pagedContacts.every(c => checkedIds.has(c.id));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold">View Inbox</h1>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Inbox type tabs */}
          {(["received", "scheduled", "sent", "rejected"] as const).map((t) => (
            <button key={t} onClick={() => { setInboxTab(t); setPage(1); }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap",
                inboxTab === t ? "bg-primary/10 text-primary border-primary/30" : "border-border/30 text-muted-foreground hover:bg-secondary/40")}>
              {t === "scheduled" && <Clock className="h-3 w-3" />}
              {t === "sent" && <Send className="h-3 w-3" />}
              {t === "rejected" && <X className="h-3 w-3" />}
              {t === "received" && <Inbox className="h-3 w-3" />}
              {t === "scheduled" ? "Scheduled Texts" : t === "sent" ? "Sent Texts" : t === "rejected" ? "Rejected Texts" : "Received"}
            </button>
          ))}
          {/* Message type toggle */}
          <div className="flex gap-1 bg-secondary/40 rounded-lg p-0.5 ml-2">
            {(["sms", "email"] as const).map(t => (
              <button key={t} onClick={() => { setMsgType(t); setSelected(null); }}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  msgType === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {t === "sms" ? "📱 SMS" : "✉️ Email"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border/20 bg-background/10 shrink-0">
        <div className="flex items-center gap-2">
          {/* Show blocked toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setShowBlocked(v => !v)}
              className={cn("w-8 h-4 rounded-full transition-colors relative", showBlocked ? "bg-primary" : "bg-secondary/60")}>
              <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all", showBlocked ? "left-4" : "left-0.5")} />
            </div>
            <span className="text-xs text-muted-foreground">Show blocked</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          {/* Pagination */}
          <span className="text-xs text-muted-foreground">{contacts.length === 0 ? "0-0" : `${(page-1)*PER_PAGE+1}-${Math.min(page*PER_PAGE, contacts.length)}`} of {contacts.length}</span>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/30 text-xs disabled:opacity-40 hover:bg-secondary/40">
            <ChevronLeft className="h-3 w-3" /> Prev
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/30 text-xs disabled:opacity-40 hover:bg-secondary/40">
            Next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {checkedIds.size > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border/20 bg-primary/5 shrink-0">
          <span className="text-xs font-medium text-primary mr-2">{checkedIds.size} selected</span>
          {[
            { label: "Disposition", icon: ChevronDown },
            { label: "Block", icon: PhoneOff },
            { label: "Unblock", icon: PhoneIncoming },
            { label: "Mark Read", icon: CheckCircle2 },
            { label: "Delete", icon: Trash2 },
          ].map(a => (
            <button key={a.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/30 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors">
              <a.icon className="h-3 w-3" />{a.label}
            </button>
          ))}
          <button onClick={() => setCheckedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[32px_2fr_3fr_1fr] gap-4 px-6 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground bg-card/10 shrink-0">
            <button onClick={() => { if (allChecked) setCheckedIds(new Set()); else setCheckedIds(new Set(pagedContacts.map(c => c.id))); }}>
              {allChecked ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
            </button>
            <span>From</span>
            <span>Message / Preview</span>
            <span>Received On</span>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto">
            {pagedContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-20 mb-3" />
                <p className="text-sm">No messages found</p>
              </div>
            ) : (
              pagedContacts.map((c) => {
                const sm = statusMeta((c as any).status);
                const isChecked = checkedIds.has(c.id);
                return (
                  <div key={c.id}
                    className={cn("grid grid-cols-[32px_2fr_3fr_1fr] gap-4 px-6 py-3 border-b border-border/10 items-center cursor-pointer transition-colors",
                      isChecked ? "bg-primary/5" : "hover:bg-secondary/20",
                      selected?.id === c.id && "bg-primary/8")}>
                    <button onClick={(e) => { e.stopPropagation(); toggleCheck(c.id); }}>
                      {isChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {/* From */}
                    <div className="flex items-center gap-2 min-w-0" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">{initials(c)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{fullName(c)}</p>
                        <p className="text-xs text-muted-foreground truncate">{msgType === "sms" ? c.phone_number : (c.email ?? c.phone_number)}</p>
                      </div>
                    </div>
                    {/* Message preview */}
                    <div className="min-w-0" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <p className="text-xs text-muted-foreground truncate italic">Click to view {msgType === "sms" ? "SMS conversation" : "email thread"}…</p>
                      <Badge className={cn("text-[9px] px-1 border mt-0.5", sm.color)}>{sm.label}</Badge>
                    </div>
                    {/* Date */}
                    <p className="text-xs text-muted-foreground" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      {formatDate((c as any).created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Thread panel */}
        {selected && (
          <div className="w-96 border-l border-border/30 shrink-0 overflow-hidden">
            <DetailPanel contact={selected} contacts={contacts} initialTab={msgType === "sms" ? "sms" : "emails"}
              onClose={() => setSelected(null)}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Prompt View ────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: "general", label: "General Business" },
  { value: "real_estate", label: "Real Estate" },
  { value: "insurance", label: "Insurance" },
  { value: "solar", label: "Solar / Home Services" },
  { value: "medical", label: "Medical / Healthcare" },
  { value: "automotive", label: "Automotive" },
  { value: "legal", label: "Legal Services" },
  { value: "finance", label: "Finance / Loans" },
  { value: "retail", label: "Retail / E-commerce" },
  { value: "other", label: "Other" },
];

// ── Prompt storage helpers ────────────────────────────────────────────────────

interface CRMPrompt {
  id: string;
  name: string;
  content: string;
  direction: "inbound" | "outbound";
  phoneNumber?: string;   // attached purchased phone number
  agentId?: number;       // voice agent linked to that phone number
  createdAt: string;
}

function loadPrompts(): CRMPrompt[] {
  try { return JSON.parse(localStorage.getItem("crm_prompts") || "[]"); } catch { return []; }
}
function savePrompts(prompts: CRMPrompt[]) {
  localStorage.setItem("crm_prompts", JSON.stringify(prompts));
}
function getActivePromptId(): string | null {
  return localStorage.getItem("crm_active_prompt_id");
}
function setActivePromptId(id: string) {
  localStorage.setItem("crm_active_prompt_id", id);
}

// ── My Prompt View ────────────────────────────────────────────────────────────

function MyPromptView() {
  const [prompts, setPrompts] = useState<CRMPrompt[]>(() => loadPrompts());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const saved = getActivePromptId();
    const list = loadPrompts();
    return saved && list.find(p => p.id === saved) ? saved : list[0]?.id ?? null;
  });

  // Creation wizard: step 1 = direction, step 2 = name
  const [pickingDirection, setPickingDirection] = useState(false);
  const [chosenDirection, setChosenDirection] = useState<"inbound" | "outbound" | null>(null);
  const [newPromptName, setNewPromptName] = useState("");

  const selected = prompts.find(p => p.id === selectedId) ?? null;
  const direction = selected?.direction ?? "outbound";

  // Editor state
  const [name, setName]           = useState(selected?.name ?? "");
  const [content, setContent]     = useState(selected?.content ?? "");
  const [mode, setMode]           = useState<"manual" | "ai" | "website">("manual");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]       = useState(false);

  // AI form fields
  const [bizName, setBizName]     = useState("");
  const [bizType, setBizType]     = useState("general");
  const [bizDesc, setBizDesc]     = useState("");
  const [services, setServices]   = useState("");
  const [tone, setTone]           = useState("professional");

  // Purchased phone numbers for attaching to prompt
  const [myNumbers, setMyNumbers]         = useState<PurchasedNumber[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [attachedNumber, setAttachedNumber] = useState<string>(selected?.phoneNumber ?? "");
  const [attachedAgentId, setAttachedAgentId] = useState<number | undefined>(selected?.agentId);
  const [attachingPhone, setAttachingPhone] = useState(false);
  const [myAgents, setMyAgents]           = useState<AgentOut[]>([]);

  useEffect(() => {
    listAgents().then(a => setMyAgents(Array.isArray(a) ? a : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingNumbers(true);
    getMyPhoneNumbers().then(nums => setMyNumbers(Array.isArray(nums) ? nums : [])).catch(() => {}).finally(() => setLoadingNumbers(false));
  }, []);

  const selectPrompt = (p: CRMPrompt) => {
    setSelectedId(p.id);
    setName(p.name);
    setContent(p.content);
    setAttachedNumber(p.phoneNumber ?? "");
    setAttachedAgentId(p.agentId);
    setMode("manual");
    setPickingDirection(false);
  };

  // Step 1: open direction picker
  const createNew = () => {
    setSelectedId(null);
    setChosenDirection(null);
    setNewPromptName("");
    setPickingDirection(true);
  };

  // Step 2: direction chosen — go to name step
  const handleDirectionChosen = (dir: "inbound" | "outbound") => {
    setChosenDirection(dir);
    setNewPromptName("");
  };

  // Step 3: name confirmed — create the prompt
  const createNewWithDirection = () => {
    if (!chosenDirection) return;
    const finalName = newPromptName.trim() || "My Prompt";
    const p: CRMPrompt = { id: Date.now().toString(), name: finalName, content: "", direction: chosenDirection, createdAt: new Date().toISOString() };
    const updated = [...prompts, p];
    setPrompts(updated);
    savePrompts(updated);
    setPickingDirection(false);
    setChosenDirection(null);
    setNewPromptName("");
    selectPrompt(p);
  };

  const deletePrompt = (id: string) => {
    if (!confirm("Delete this prompt?")) return;
    const updated = prompts.filter(p => p.id !== id);
    setPrompts(updated);
    savePrompts(updated);
    if (selectedId === id) {
      const next = updated[0] ?? null;
      if (next) selectPrompt(next); else { setSelectedId(null); setName(""); setContent(""); }
    }
  };

  const handleSave = () => {
    if (!selectedId) return;
    setSaving(true);
    const updated = prompts.map(p =>
      p.id === selectedId
        ? { ...p, name, content, phoneNumber: attachedNumber || undefined, agentId: attachedAgentId }
        : p
    );
    setPrompts(updated);
    savePrompts(updated);
    setActivePromptId(selectedId);
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Prompt saved!", description: `"${name}" (${direction})${attachedNumber ? ` · ${attachedNumber}` : ""} ready for AI Pulse.` });
    }, 300);
  };

  // Attach a purchased phone number to this prompt — finds the agent for that number,
  // pushes the current prompt content to it, and saves the agentId.
  const handleAttachPhone = async (phoneNumber: string) => {
    setAttachedNumber(phoneNumber);
    if (!phoneNumber) { setAttachedAgentId(undefined); return; }
    setAttachingPhone(true);
    try {
      // Find matching agent by phone number
      const agent = myAgents.find(a =>
        a.phone_number === phoneNumber ||
        a.phone_number === phoneNumber.replace(/^\+1/, "") ||
        `+1${a.phone_number}` === phoneNumber
      );
      if (agent) {
        // Push current prompt content to that agent's system_prompt
        if (content.trim()) {
          await updateAgent(agent.id, { system_prompt: content });
        }
        setAttachedAgentId(agent.id);
        toast({ title: "Phone number attached!", description: `AI Pulse will call from ${phoneNumber} using this prompt.` });
      } else {
        setAttachedAgentId(undefined);
        toast({ title: "Phone attached", description: `${phoneNumber} saved. No voice agent found for this number — calls will use default settings.`, variant: "default" });
      }
    } catch (err: any) {
      toast({ title: "Attach failed", description: err.message, variant: "destructive" });
    } finally {
      setAttachingPhone(false);
    }
  };

  const setAsActive = (id: string) => {
    setActivePromptId(id);
    const p = prompts.find(x => x.id === id);
    toast({ title: "Active prompt set", description: `Power Dialer will use "${p?.name}" (${p?.direction})` });
  };

  const generateFromWebsite = async () => {
    if (!websiteUrl.trim()) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://isibi-backend.onrender.com/api/agents/generate-prompt-from-url", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: websiteUrl, call_direction: direction }),
      });
      const data = await res.json();
      if (res.ok && data.prompt) { setContent(data.prompt); setMode("manual"); toast({ title: "Prompt generated!", description: data.page_title || websiteUrl }); }
      else toast({ title: "Failed to generate", description: data?.detail || "Try again", variant: "destructive" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const generateWithAI = async () => {
    if (!bizName.trim()) { toast({ title: "Enter a business name", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const result = await generateAIPromptAdvanced({
        business_name: bizName, business_type: bizType,
        business_description: bizDesc, services, tone,
        assistant_name: name || "AI Assistant",
        call_direction: direction,
        special_instructions: "", hours: "", phone_number: "", address: "",
      });
      setContent((result as any).prompt || (result as any));
      setMode("manual");
      toast({ title: `${direction === "outbound" ? "Outbound sales" : "Inbound"} prompt generated!` });
    } catch (err: any) { toast({ title: "Generation failed", description: err.message, variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const activeId = getActivePromptId();

  const directionTips = {
    outbound: ["Introduce name + company + reason for calling in the first 5 seconds","Ask a qualifying question right away to start a dialogue","Goal: qualify the lead and book a follow-up — not close on the first call","Handle objections briefly: 'Not interested' → ask why, then thank and end","Always end with a clear next step: confirm a time or get permission to follow up"],
    inbound:  ["Greet warmly, state your name and company, then immediately ask how you can help","Let the caller lead — listen before offering anything","Never push — respond to what they actually need","Collect their name and purpose naturally, not like a form","Offer a next step only if the caller seems ready for it"],
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — prompt list */}
      <div className="w-56 shrink-0 border-r border-border/30 flex flex-col bg-card/20">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border/20">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompts</span>
          <button onClick={createNew} className="p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="New prompt">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {prompts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/60 text-xs space-y-2">
              <BotMessageSquare className="h-8 w-8 mx-auto opacity-30" />
              <p>No prompts yet</p>
              <button onClick={createNew} className="text-primary hover:underline">Create your first</button>
            </div>
          )}
          {prompts.map(p => (
            <div key={p.id} onClick={() => selectPrompt(p)}
              className={cn("group relative flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                selectedId === p.id ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/50 border border-transparent")}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium truncate flex-1">{p.name || "Untitled"}</span>
                {p.id === activeId && <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-1.5 shrink-0">Active</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[9px] rounded-full px-1.5 border font-medium shrink-0",
                  (p.direction ?? "outbound") === "outbound"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                  {(p.direction ?? "outbound") === "outbound" ? "Outbound" : "Inbound"}
                </span>
                <p className="text-[10px] text-muted-foreground truncate">{p.content ? p.content.slice(0, 30) + "…" : "Empty"}</p>
              </div>
              {p.phoneNumber && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="h-2.5 w-2.5 text-primary/60 shrink-0" />
                  <p className="text-[9px] text-primary/60 font-mono truncate">{p.phoneNumber}</p>
                </div>
              )}
              <button onClick={e => { e.stopPropagation(); deletePrompt(p.id); }}
                className="absolute right-1 top-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right — editor */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Creation wizard ── */}
        {pickingDirection ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">

            {/* Step 1: direction */}
            {!chosenDirection && (<>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-foreground">What type of prompt do you need?</p>
                <p className="text-sm text-muted-foreground">Choose a direction — this is set once per prompt.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                {([
                  { id: "outbound" as const, icon: PhoneCall,     label: "Outbound", desc: "AI calls your leads to sell, qualify, or follow up",           color: "border-blue-500 bg-blue-500/5 hover:bg-blue-500/10",     iconColor: "bg-blue-500/15 text-blue-400",     textColor: "text-blue-400" },
                  { id: "inbound"  as const, icon: PhoneIncoming, label: "Inbound",  desc: "AI answers calls from customers — support, inquiries, booking", color: "border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10", iconColor: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400" },
                ]).map(opt => (
                  <button key={opt.id} onClick={() => handleDirectionChosen(opt.id)}
                    className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-all shadow-sm", opt.color)}>
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", opt.iconColor)}>
                      <opt.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-bold", opt.textColor)}>{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-1">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setPickingDirection(false)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Cancel</button>
            </>)}

            {/* Step 2: name */}
            {chosenDirection && (
              <div className="w-full max-w-sm space-y-5">
                {/* Direction badge */}
                <div className="flex items-center justify-center gap-2">
                  <span className={cn("text-xs font-semibold rounded-full px-3 py-1 border",
                    chosenDirection === "outbound" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                    {chosenDirection === "outbound" ? "📞 Outbound" : "📥 Inbound"}
                  </span>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-foreground">Name your prompt</p>
                  <p className="text-sm text-muted-foreground">Give it a clear name so you can find it in Power Dialer.</p>
                </div>
                <Input
                  autoFocus
                  placeholder={chosenDirection === "outbound" ? "e.g. Solar Leads Outbound" : "e.g. Customer Support Inbound"}
                  value={newPromptName}
                  onChange={e => setNewPromptName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newPromptName.trim()) createNewWithDirection(); }}
                  className="h-11 text-sm text-center"
                />
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setChosenDirection(null)}>
                    ← Back
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5" onClick={createNewWithDirection} disabled={!newPromptName.trim()}>
                    <Plus className="h-3.5 w-3.5" /> Create Prompt
                  </Button>
                </div>
              </div>
            )}
          </div>

        ) : !selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <BotMessageSquare className="h-16 w-16 opacity-20" />
            <p className="text-sm">Select a prompt or create a new one</p>
            <Button onClick={createNew} size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Prompt</Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-card/20 shrink-0">
              <BotMessageSquare className="h-5 w-5 text-primary shrink-0" />
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Prompt name…"
                className="h-8 text-sm font-semibold bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 flex-1" />
              {/* Direction badge — read-only, set at creation */}
              <span className={cn("text-[10px] font-semibold rounded-full px-2.5 py-0.5 border shrink-0",
                direction === "outbound"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                {direction === "outbound" ? "Outbound" : "Inbound"}
              </span>
              {/* Attached number badge */}
              {attachedNumber && (
                <span className="text-[10px] font-mono font-medium rounded-full px-2.5 py-0.5 border bg-primary/10 text-primary border-primary/20 shrink-0 flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />{attachedNumber}
                </span>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {selected.id !== activeId
                  ? <Button variant="outline" size="sm" onClick={() => setAsActive(selected.id)} className="h-7 text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Set Active</Button>
                  : <Badge className="border border-green-500/30 text-green-400 bg-green-500/10 text-xs">Active</Badge>}
                <Button onClick={handleSave} disabled={saving} size="sm" className="h-7 text-xs gap-1">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Save
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-5">

              {/* ── STEP 1: Generation mode ── */}
              <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 — Generate Prompt</h3>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "manual" as const,  icon: Pencil,   label: "Write Manually" },
                    { id: "ai" as const,      icon: Sparkles, label: "Generate with AI" },
                    { id: "website" as const, icon: Globe,    label: "From Website" },
                  ]).map(opt => (
                    <button key={opt.id} onClick={() => setMode(opt.id)}
                      className={cn("flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all",
                        mode === opt.id ? "border-primary bg-primary/5" : "border-border/40 hover:border-border hover:bg-card/50")}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", mode === opt.id ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                        <opt.icon className="h-3.5 w-3.5" />
                      </div>
                      <span className={cn("text-[11px] font-semibold leading-tight", mode === opt.id ? "text-foreground" : "text-muted-foreground")}>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Direction context banner */}
                <div className={cn("rounded-lg px-3 py-2 text-xs flex items-center gap-2",
                  direction === "outbound" ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20")}>
                  {direction === "outbound"
                    ? <><PhoneCall className="h-3.5 w-3.5 shrink-0" /> Prompt will be generated for <strong className="mx-1">outbound sales calls</strong> — AI calls prospects to sell / qualify.</>
                    : <><PhoneIncoming className="h-3.5 w-3.5 shrink-0" /> Prompt will be generated for <strong className="mx-1">inbound calls</strong> — AI answers and assists callers.</>}
                </div>

                {mode === "website" && (
                  <div className="rounded-xl border border-border/30 bg-secondary/20 p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Paste your business URL — we'll scrape it and generate a <strong>{direction}</strong> call prompt.</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input type="url" placeholder="https://yourbusiness.com" value={websiteUrl}
                          onChange={e => setWebsiteUrl(e.target.value)} className="pl-8 h-8 text-sm"
                          onKeyDown={e => { if (e.key === "Enter") generateFromWebsite(); }} />
                      </div>
                      <Button onClick={generateFromWebsite} disabled={generating || !websiteUrl.trim()} size="sm" className="gap-1 h-8 text-xs">
                        {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {generating ? "Generating…" : "Generate"}
                      </Button>
                    </div>
                  </div>
                )}

                {mode === "ai" && (
                  <div className="rounded-xl border border-border/30 bg-secondary/20 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Business Name *</Label>
                        <Input placeholder="Premier Realty" value={bizName} onChange={e => setBizName(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Business Type</Label>
                        <select value={bizType} onChange={e => setBizType(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs appearance-none">
                          {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{direction === "outbound" ? "What you sell / offer" : "What you do"}</Label>
                        <Input placeholder={direction === "outbound" ? "We help homeowners sell fast…" : "We provide roofing services…"} value={bizDesc} onChange={e => setBizDesc(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Key services / products</Label>
                        <Input placeholder={direction === "outbound" ? "Free consult, ROI analysis, fast close…" : "Free estimate, emergency repair, warranty…"} value={services} onChange={e => setServices(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Tone</Label>
                        <select value={tone} onChange={e => setTone(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs appearance-none">
                          {["professional","friendly","formal","warm"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button onClick={generateWithAI} disabled={generating || !bizName.trim()} size="sm" className="w-full gap-1 h-8 text-xs">
                          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                          {generating ? "Generating…" : `Generate ${direction === "outbound" ? "Outbound" : "Inbound"} Prompt`}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Phone number attachment ── */}
              <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone Number</h3>
                  {attachedNumber && (
                    <button onClick={() => setAttachedNumber("")}
                      className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                      <X className="h-3 w-3" /> Detach
                    </button>
                  )}
                </div>
                {loadingNumbers ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your numbers…
                  </div>
                ) : myNumbers.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    No numbers purchased yet — go to <strong className="mx-1">Phone Setup</strong> to buy one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Attach a phone number to this prompt. Calls using this prompt will show this number to recipients.</p>
                    <div className="grid gap-2">
                      {/* "None" option */}
                      <button onClick={() => setAttachedNumber("")}
                        className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all",
                          !attachedNumber ? "border-primary/40 bg-primary/5" : "border-border/30 hover:border-border/60 hover:bg-secondary/30")}>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                          !attachedNumber ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                          <X className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className={cn("text-xs font-semibold", !attachedNumber ? "text-foreground" : "text-muted-foreground")}>No number</p>
                          <p className="text-[10px] text-muted-foreground">Use default / system number</p>
                        </div>
                        {!attachedNumber && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                      </button>

                      {myNumbers.map(n => {
                        const num = n.phone_number ?? (n as any).phoneNumber ?? (n as any).number ?? "";
                        const friendly = n.friendly_name ?? (n as any).friendlyName ?? num;
                        const isAttached = attachedNumber === num;
                        return (
                          <button key={num} onClick={() => setAttachedNumber(num)}
                            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all",
                              isAttached ? "border-primary/40 bg-primary/5" : "border-border/30 hover:border-border/60 hover:bg-secondary/30")}>
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                              isAttached ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                              <Phone className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-semibold font-mono", isAttached ? "text-foreground" : "text-muted-foreground")}>{num}</p>
                              {friendly !== num && <p className="text-[10px] text-muted-foreground truncate">{friendly}</p>}
                            </div>
                            {isAttached && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── STEP 2: Prompt editor ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Step 2 — Prompt Content</Label>
                  <span className="text-[10px] text-muted-foreground">{content.length} chars</span>
                </div>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder={direction === "outbound"
                    ? "You are Alex, an outbound sales agent for Premier Realty.\nYou are calling prospects who may be interested in selling their home.\nYour goal is to qualify them and book a 10-minute intro call with our team.\nBe direct, friendly, and never pushy.\n\nOpening: 'Hi, is this [name]? This is Alex from Premier Realty — quick question: have you ever thought about what your home might be worth today?'"
                    : "You are Alex, an inbound support agent for Premier Realty.\nYou answer calls from people interested in buying or selling a home.\nGreet warmly, listen first, then respond to what they actually need.\nNever push — let the caller lead the conversation."}
                  className="w-full h-48 rounded-xl border border-border/40 bg-background/50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
              </div>

              {/* Tips */}
              <div className="rounded-xl border border-border/20 bg-secondary/10 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {direction === "outbound" ? "📞 Outbound Tips" : "📥 Inbound Tips"}
                </p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {directionTips[direction].map((tip, i) => (
                    <li key={i} className="flex gap-2"><CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />{tip}</li>
                  ))}
                </ul>
              </div>

              {/* ── Step 3: Attach Phone Number ── */}
              <div className={cn("rounded-xl border-2 p-4 space-y-3 transition-colors",
                attachedNumber ? "border-green-500/30 bg-green-500/5" : "border-border/30 bg-card/40")}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    attachedNumber ? "bg-green-500/15" : "bg-secondary")}>
                    <Phone className={cn("h-3.5 w-3.5", attachedNumber ? "text-green-400" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Step 3 — Attach Phone Number</p>
                    <p className="text-[10px] text-muted-foreground">
                      {attachedNumber
                        ? `AI Pulse calls from ${attachedNumber}${attachedAgentId ? " · agent linked ✓" : ""}`
                        : "Select which number AI Pulse calls from"}
                    </p>
                  </div>
                  {attachingPhone && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                </div>

                {loadingNumbers ? (
                  <p className="text-[11px] text-muted-foreground">Loading your numbers…</p>
                ) : myNumbers.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No purchased numbers yet — go to <strong>Phone Setup</strong> to buy one.
                  </p>
                ) : (
                  <select
                    value={attachedNumber}
                    onChange={e => handleAttachPhone(e.target.value)}
                    disabled={attachingPhone}
                    className={cn(
                      "w-full rounded-lg border px-3 h-9 text-sm bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30",
                      attachedNumber ? "border-green-500/30 text-foreground" : "border-border/40 text-muted-foreground"
                    )}>
                    <option value="">— choose a number —</option>
                    {myNumbers.map(n => (
                      <option key={n.twilio_sid ?? n.phone_number} value={n.phone_number}>
                        {n.phone_number}{n.friendly_name ? ` · ${n.friendly_name}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Billing / Credits View ────────────────────────────────────────────────────

function BillingView({ balance, onRefresh }: { balance: number | null; onRefresh: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Credits & Billing</h1>
          <p className="text-xs text-muted-foreground">Shared balance across Voice Agent, CRM, and Workflow</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-2xl">
        {/* Balance card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Available Credits</p>
            <p className="text-4xl font-bold text-primary">
              {balance !== null ? `$${balance.toFixed(2)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Used across Voice Agent · CRM calls · Workflow automations</p>
          </div>
          {balance !== null && balance < 5 && (
            <Badge className="border border-yellow-500/30 text-yellow-400 bg-yellow-500/10">Low balance</Badge>
          )}
        </div>

        {/* Rate info */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Pricing</h2>
          {[
            { label: "Voice Agent calls", rate: "$0.20 / min", icon: Phone, color: "text-blue-400" },
            { label: "CRM AI Pulse calls", rate: "$0.20 / min", icon: Rocket, color: "text-primary" },
            { label: "Outbound SMS", rate: "$0.01 / msg", icon: MessageSquare, color: "text-green-400" },
            { label: "Inbound SMS", rate: "$0.01 / msg", icon: MessageSquare, color: "text-emerald-400" },
            { label: "Workflow automations", rate: "Varies", icon: Activity, color: "text-purple-400" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
              <item.icon className={cn("h-4 w-4 shrink-0", item.color)} />
              <span className="text-sm flex-1">{item.label}</span>
              <span className="text-sm font-semibold text-primary">{item.rate}</span>
            </div>
          ))}
        </div>

        {/* Top up CTA */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Add Credits</p>
            <p className="text-xs text-muted-foreground">Top up your balance to keep calls and messages running</p>
          </div>
          <Button onClick={() => window.open("/customer-dashboard", "_self")} className="gap-2 shrink-0">
            <CreditCard className="h-4 w-4" /> Add Credits
          </Button>
        </div>
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
  const [view, setView] = useState<View>("my_prompt");
  const fileRef = useRef<HTMLInputElement>(null);

  // Credits — shared across all agent pages
  const [balance, setBalance] = useState<number | null>(null);
  const refreshBalance = () => {
    getCreditsBalance().then(r => setBalance(r.balance ?? 0)).catch(() => {});
  };
  useEffect(() => { refreshBalance(); const t = setInterval(refreshBalance, 30000); return () => clearInterval(t); }, []);

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
    const matchSearch = !q || fullName(c).toLowerCase().includes(q) || c.phone_number.includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
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
      setShowForm(false); setEditContact(null);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateContactStatus(id, status);
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } as any : c));
      if (selected?.id === id) setSelected((s) => s ? { ...s, status } as any : s);
      toast({ title: `Status → ${statusMeta(status).label}` });
    } catch { toast({ title: "Failed to update status", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) setSelected(null);
      toast({ title: "Contact deleted" });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
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
      } catch { toast({ title: "Import failed", variant: "destructive" }); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadSample = () => {
    const csv = "first_name,last_name,phone_number,email,company,notes\nJohn,Doe,+13055551234,john@example.com,Acme Corp,\nJane,Smith,+13055555678,jane@example.com,,Call back Friday";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "contacts_sample.csv"; a.click();
  };

  const NAV_ITEMS: { id: View; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: "my_prompt",    label: "My Prompt",     icon: BotMessageSquare, badge: "AI" },
    { id: "dashboard",    label: "Dashboard",     icon: LayoutDashboard },
    { id: "contacts",     label: "Leads",         icon: Users },
    { id: "power_dialer", label: "AI Pulse",       icon: Rocket },
    { id: "inbox",        label: "Inbox",         icon: Inbox },
    { id: "pipeline",     label: "Sales Pipeline",icon: Columns3 },
    { id: "calendar",     label: "Google Calendar",icon: Calendar },
    { id: "reports",      label: "Reports",       icon: BarChart3 },
    { id: "campaigns",    label: "Campaigns",     icon: Send },
    { id: "calls",        label: "Calls",         icon: PhoneCall },
    { id: "sms",          label: "Messages",      icon: MessageSquare },
    { id: "emails",       label: "Emails",        icon: Mail },
    { id: "tasks",        label: "Tasks",         icon: ClipboardList },
    { id: "phone_setup",  label: "Phone Setup",   icon: Phone },
    { id: "billing",      label: "Credits & Billing", icon: CreditCard },
  ];

  // SMS global view
  const [allSmsContacts, setAllSmsContacts] = useState<Contact | null>(null);

  // Advanced leads filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPowerDialer, setFilterPowerDialer] = useState(false);
  const [filterShowBlocked, setFilterShowBlocked] = useState(false);
  const [filterVendor, setFilterVendor] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterTimezone, setFilterTimezone] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col shrink-0 border-r border-border/30 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-52"
      )}>
        <div className="flex items-center gap-2 px-3 h-16 border-b border-border/30 shrink-0">
          {!sidebarCollapsed && <span className="text-lg font-bold gradient-text flex-1">CRM Agent</span>}
          <button onClick={() => setSidebarCollapsed((v) => !v)}
            className={cn("p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors", sidebarCollapsed && "mx-auto")}>
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Credits badge — always visible, shared across all agent pages */}
        <button onClick={() => setView("billing")}
          className={cn(
            "mx-2 mt-2 mb-0 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all border",
            sidebarCollapsed && "justify-center px-2 mx-1",
            view === "billing"
              ? "bg-primary/10 border-primary/20 text-primary"
              : balance !== null && balance < 5
              ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              : "bg-primary/5 border-primary/10 text-primary hover:bg-primary/10"
          )}>
          <CreditCard className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && balance !== null && (
            <>
              <span className="font-semibold">${balance.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground ml-auto">credits</span>
            </>
          )}
          {!sidebarCollapsed && balance === null && (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </button>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => { setView(item.id); if (item.id !== "contacts") setSelected(null); }}
              className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                sidebarCollapsed && "justify-center px-2",
                view === item.id ? "bg-primary/10 text-primary border border-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50")}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!sidebarCollapsed && item.badge && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 rounded-full px-1.5 py-0.5 border border-yellow-500/30">{item.badge}</span>
              )}
              {!sidebarCollapsed && item.id === "contacts" && contacts.length > 0 && (
                <span className="text-xs bg-secondary/60 rounded-full px-1.5 py-0.5">{contacts.length}</span>
              )}
            </button>
          ))}

          {/* Pipeline sub-filters (only in contacts view) */}
          {view === "contacts" && !sidebarCollapsed && (
            <div className="mt-2 pt-2 border-t border-border/20 space-y-0.5">
              <button onClick={() => setFilterStatus("all")}
                className={cn("w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs transition-all",
                  filterStatus === "all" ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30")}>
                <Filter className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">All</span>
                <span className="text-[10px] bg-secondary/60 rounded-full px-1.5">{contacts.length}</span>
              </button>
              {STATUSES.map((s) => (
                <button key={s.id} onClick={() => setFilterStatus(s.id)}
                  className={cn("w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs transition-all",
                    filterStatus === s.id ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30")}>
                  <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />
                  <span className="flex-1 text-left">{s.label}</span>
                  {(counts[s.id] ?? 0) > 0 && <span className="text-[10px] bg-secondary/60 rounded-full px-1.5">{counts[s.id]}</span>}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-border/30 p-3 space-y-1">
          <button onClick={() => navigate("/customer-dashboard")}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors", sidebarCollapsed && "justify-center px-2")}>
            <Bot className="h-4 w-4" />{!sidebarCollapsed && "Voice Agent"}
          </button>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("account_type"); navigate("/"); }}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors", sidebarCollapsed && "justify-center px-2")}>
            <LogOut className="h-4 w-4" />{!sidebarCollapsed && "Log Out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Dashboard */}
        {view === "dashboard" && <DashboardView contacts={contacts} />}

        {/* Contacts / Leads */}
        {view === "contacts" && (
          <>
            {/* Topbar */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">View Leads</h1>
                  <p className="text-xs text-muted-foreground">{filtered.length} lead{filtered.length !== 1 ? "s" : ""}{filterStatus !== "all" ? ` · ${statusMeta(filterStatus).label}` : ""}</p>
                </div>
              </div>
              {/* Filter chip */}
              {filterStatus !== "all" && (
                <div className="flex items-center gap-1.5 bg-secondary/50 border border-border/40 rounded-lg px-2.5 py-1 text-xs">
                  <span className={cn("w-2 h-2 rounded-full", statusMeta(filterStatus).dot)} />
                  {statusMeta(filterStatus).label}
                  <button onClick={() => setFilterStatus("all")} className="ml-1 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={downloadSample} className="h-8 text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" /> Generate CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-8 text-xs gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Upload CSV File
              </Button>
              <Button size="sm" onClick={() => { setEditContact(null); setShowForm(true); }} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create Lead
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            </div>

            {/* Advanced Filters Panel */}
            <div className="border-b border-border/20 bg-background/20 shrink-0">
              {/* Row 1: Date + Vendor + State + Timezone */}
              <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Leads from</label>
                  <div className="relative">
                    <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      className="h-8 text-xs bg-background/50 pr-7" />
                    {filterDateFrom && <button onClick={() => setFilterDateFrom("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Leads to</label>
                  <div className="relative">
                    <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      className="h-8 text-xs bg-background/50 pr-7" />
                    {filterDateTo && <button onClick={() => setFilterDateTo("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Lead Vendor</label>
                  <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs">
                    <option value="">All Vendors</option>
                    {["Facebook","Google","LinkedIn","Referral","Website","Cold Call","Other"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">State</label>
                  <select value={filterState} onChange={e => setFilterState(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs">
                    <option value="">All States</option>
                    {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Timezone</label>
                  <select value={filterTimezone} onChange={e => setFilterTimezone(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background/50 px-2 text-xs">
                    <option value="">All Timezones</option>
                    {["Eastern","Central","Mountain","Pacific","Alaska","Hawaii"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-2 pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setFilterPowerDialer(v => !v)}
                      className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0", filterPowerDialer ? "bg-primary" : "bg-secondary/60")}>
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", filterPowerDialer ? "left-4" : "left-0.5")} />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Power Dialer only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setFilterShowBlocked(v => !v)}
                      className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0", filterShowBlocked ? "bg-destructive" : "bg-secondary/60")}>
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", filterShowBlocked ? "left-4" : "left-0.5")} />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Show blocked</span>
                  </label>
                </div>
              </div>

              {/* Status filter row */}
              <div className="flex items-center gap-2 px-6 pb-3 overflow-x-auto">
                <button onClick={() => setFilterStatus("all")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all",
                    filterStatus === "all" ? "bg-primary/10 text-primary border-primary/30" : "border-border/30 text-muted-foreground hover:bg-secondary/40")}>
                  <Filter className="h-3 w-3" /> All <span className="font-bold">{contacts.length}</span>
                </button>
                {STATUSES.map((s) => (
                  <button key={s.id} onClick={() => setFilterStatus(s.id)}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all",
                      filterStatus === s.id ? cn(s.color, "border-current") : "border-border/30 text-muted-foreground hover:bg-secondary/40")}>
                    <span className={cn("w-2 h-2 rounded-full", s.dot)} />{s.label}
                    <span className="font-bold">{counts[s.id] ?? 0}</span>
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or email…"
                      className="pl-8 h-8 text-xs bg-background/50 w-52" />
                  </div>
                  {(search || filterDateFrom || filterDateTo || filterPowerDialer || filterShowBlocked || filterVendor || filterState || filterTimezone) && (
                    <Button size="sm" variant="outline" onClick={() => { setSearch(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterPowerDialer(false); setFilterShowBlocked(false); setFilterVendor(""); setFilterState(""); setFilterTimezone(""); }}
                      className="h-8 text-xs gap-1">
                      <X className="h-3 w-3" /> Reset
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setView("power_dialer")} className="h-8 text-xs gap-1.5">
                    <Rocket className="h-3.5 w-3.5" /> AI Pulse
                  </Button>
                </div>
              </div>

              {/* Bulk action bar */}
              {selectedLeads.size > 0 && (
                <div className="flex items-center gap-2 px-6 py-2 bg-primary/5 border-t border-primary/20">
                  <span className="text-xs font-medium text-primary">{selectedLeads.size} selected</span>
                  <button onClick={() => setSelectedLeads(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-2">Deselect all</button>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { filtered.forEach(c => setSelectedLeads(s => { const n = new Set(s); n.add(c.id); return n; })); }}>Select All</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Contact list + detail panel */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading contacts…</div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                    <Users className="h-12 w-12 text-muted-foreground/40" />
                    <p className="text-muted-foreground">{search || filterStatus !== "all" ? "No contacts match your filter" : "No contacts yet"}</p>
                    {!search && filterStatus === "all" && (
                      <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add your first contact</Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Header row */}
                    <div className="grid grid-cols-[24px_40px_2fr_1fr_1fr_1fr_120px] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground border-b border-border/20">
                      <button onClick={() => {
                        if (selectedLeads.size === filtered.length) setSelectedLeads(new Set());
                        else setSelectedLeads(new Set(filtered.map(c => c.id)));
                      }}>
                        {selectedLeads.size === filtered.length && filtered.length > 0
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          : <Square className="h-3.5 w-3.5" />}
                      </button>
                      <span />
                      <span>Name</span><span>Phone</span><span>Status</span><span>Source</span><span>Actions</span>
                    </div>
                    {filtered.map((c) => {
                      const sm = statusMeta((c as any).status);
                      const isActive = selected?.id === c.id;
                      const isChecked = selectedLeads.has(c.id);
                      return (
                        <div key={c.id}
                          className={cn("grid grid-cols-[24px_40px_2fr_1fr_1fr_1fr_120px] gap-3 items-center p-3 rounded-xl border cursor-pointer transition-all",
                            isActive ? "bg-primary/5 border-primary/20" : isChecked ? "bg-secondary/30 border-border/50" : "bg-card/40 border-border/30 hover:bg-secondary/20 hover:border-border/50")}>
                          {/* Checkbox */}
                          <button onClick={(e) => { e.stopPropagation(); setSelectedLeads(s => { const n = new Set(s); isChecked ? n.delete(c.id) : n.add(c.id); return n; }); }}>
                            {isChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                          </button>
                          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary shrink-0" onClick={() => setSelected(isActive ? null : c)}>
                            {initials(c)}
                          </div>
                          {/* Name + company */}
                          <div className="min-w-0" onClick={() => setSelected(isActive ? null : c)}>
                            <p className="font-medium text-sm truncate">{fullName(c)}</p>
                            {c.company && <p className="text-xs text-muted-foreground truncate">{c.company}</p>}
                            {c.email && <p className="text-xs text-muted-foreground/70 truncate">{c.email}</p>}
                          </div>
                          {/* Phone */}
                          <div className="text-xs text-muted-foreground" onClick={() => setSelected(isActive ? null : c)}>
                            {c.phone_number}
                          </div>
                          {/* Status */}
                          <div onClick={() => setSelected(isActive ? null : c)}>
                            <Badge className={cn("text-[10px] px-1.5 py-0 border", sm.color)}>{sm.label}</Badge>
                          </div>
                          {/* Source */}
                          <div className="text-xs text-muted-foreground truncate" onClick={() => setSelected(isActive ? null : c)}>
                            {(c as any).source ?? "—"}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <a href={`tel:${c.phone_number}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-500/10 transition-colors" title="Call"><Phone className="h-3.5 w-3.5" /></a>
                            {c.email && <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Email"><Mail className="h-3.5 w-3.5" /></a>}
                            <button onClick={() => { setEditContact(c); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selected && (
                <DetailPanel
                  contact={selected}
                  contacts={contacts}
                  onClose={() => setSelected(null)}
                  onStatusChange={handleStatusChange}
                  onEdit={(c) => { setEditContact(c); setShowForm(true); }}
                  onDelete={handleDelete}
                />
              )}
            </div>
          </>
        )}

        {/* Calls */}
        {view === "calls" && <CallsView />}

        {/* SMS — select a contact first */}
        {view === "sms" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
              <div>
                <h1 className="text-xl font-bold">Messages (SMS)</h1>
                <p className="text-xs text-muted-foreground">Select a contact to view conversation</p>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Contact list */}
              <div className="w-64 border-r border-border/30 overflow-y-auto p-3 space-y-1 shrink-0">
                {contacts.map((c) => (
                  <button key={c.id} onClick={() => setAllSmsContacts(c)}
                    className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                      allSmsContacts?.id === c.id ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/40")}>
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">{initials(c)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fullName(c)}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.phone_number}</p>
                    </div>
                  </button>
                ))}
              </div>
              {/* SMS thread */}
              {allSmsContacts ? (
                <div className="flex-1 overflow-hidden">
                  <DetailPanel contact={allSmsContacts} contacts={contacts} initialTab="sms"
                    onClose={() => setAllSmsContacts(null)}
                    onStatusChange={handleStatusChange}
                    onEdit={(c) => { setEditContact(c); setShowForm(true); }}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Select a contact to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emails — select a contact first */}
        {view === "emails" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
              <div>
                <h1 className="text-xl font-bold">Emails</h1>
                <p className="text-xs text-muted-foreground">Select a contact to view email history</p>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 border-r border-border/30 overflow-y-auto p-3 space-y-1 shrink-0">
                {contacts.map((c) => (
                  <button key={c.id} onClick={() => setAllSmsContacts(c)}
                    className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                      allSmsContacts?.id === c.id ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/40")}>
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">{initials(c)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fullName(c)}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone_number}</p>
                    </div>
                  </button>
                ))}
              </div>
              {allSmsContacts ? (
                <div className="flex-1 overflow-hidden">
                  <DetailPanel contact={allSmsContacts} contacts={contacts} initialTab="emails"
                    onClose={() => setAllSmsContacts(null)}
                    onStatusChange={handleStatusChange}
                    onEdit={(c) => { setEditContact(c); setShowForm(true); }}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Select a contact to view emails</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar */}
        {view === "calendar" && <CalendarView contacts={contacts} />}

        {/* Tasks */}
        {view === "tasks" && <TasksView contacts={contacts} />}

        {/* Sales Pipeline */}
        {view === "pipeline" && (
          <PipelineView contacts={contacts} onStatusChange={handleStatusChange}
            onEdit={(c) => { setEditContact(c); setShowForm(true); }}
            onDelete={handleDelete} />
        )}

        {/* Power Dialer */}
        {view === "power_dialer" && (
          <PowerDialerView contacts={contacts} onStatusChange={handleStatusChange} />
        )}

        {/* Reports */}
        {view === "reports" && <ReportsView contacts={contacts} />}

        {/* Campaigns */}
        {view === "campaigns" && <CampaignsView contacts={contacts} />}

        {/* Phone Setup */}
        {view === "phone_setup" && <PhoneSetupView />}

        {/* Inbox */}
        {view === "inbox" && (
          <InboxView contacts={contacts} onStatusChange={handleStatusChange}
            onEdit={(c) => { setEditContact(c); setShowForm(true); }}
            onDelete={handleDelete} />
        )}

        {/* My Prompt */}
        {view === "my_prompt" && <MyPromptView />}

        {/* Billing */}
        {view === "billing" && <BillingView balance={balance} onRefresh={refreshBalance} />}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <ContactForm initial={editContact ?? undefined} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditContact(null); }} saving={saving} />
      )}
    </div>
  );
}

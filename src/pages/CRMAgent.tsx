import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip as RechartTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
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
  Settings, User, Bell, Lock, MapPin, Contact, RefreshCcw,
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
  getCreditsBalance, listAgents, initiateOutboundCall, initiateManualCall, updateAgent,
  generateAIPromptAdvanced,
  startAISMS, listAISMSSessions, getAISMSMessages, closeAISMSSession,
  listPresetTexts, createPresetText, updatePresetText, deletePresetText,
  listDripSequences, createDripSequence, updateDripSequence, deleteDripSequence,
  listKeywords, createKeyword, deleteKeyword,
  listPresetReplies, createPresetReply, deletePresetReply,
  listLeadVendors, createLeadVendor, updateLeadVendor, deleteLeadVendor,
  listCampaignsCRM, createCampaignCRM, deleteCampaignCRM,
  listEmailPresetTexts, createEmailPresetText, updateEmailPresetText, deleteEmailPresetText,
  listEmailDripSequences, createEmailDripSequence, updateEmailDripSequence, deleteEmailDripSequence,
  listEmailPresetReplies, createEmailPresetReply, deleteEmailPresetReply,
  getAccountProfile, updateAccountProfile,
  type Contact, type ContactCreateRequest,
  type ContactCall, type ContactSMS, type ContactEmail,
  type Appointment, type Task, type CRMCall,
  type AgentOut, type AISMSSession, type AISMSMessage,
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
type View = "dashboard" | "contacts" | "calls" | "sms" | "emails" | "calendar" | "tasks" | "pipeline" | "power_dialer" | "reports" | "inbox" | "campaigns" | "phone_setup" | "my_prompt" | "billing" | "ai_sms" | "sms_marketing" | "lead_vendors" | "email_marketing" | "account_settings";

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
              <div className="grid grid-cols-[1.6fr_0.7fr_0.9fr_0.8fr_0.8fr_1.1fr_2fr_0.4fr] gap-3 px-4 pb-1 text-xs font-medium text-muted-foreground border-b border-border/20">
                <span>Contact</span><span>Type</span><span>Phone</span><span>Direction</span><span>Duration</span><span>Status</span><span>Recording</span><span></span>
              </div>
              {calls.map((c) => (
                <div key={c.id} className="grid grid-cols-[1.6fr_0.7fr_0.9fr_0.8fr_0.8fr_1.1fr_2fr_0.4fr] gap-3 px-4 py-2.5 rounded-xl bg-card/40 border border-border/20 text-sm items-center hover:bg-secondary/20 transition-colors">
                  <div>
                    <p className="text-xs font-medium">{c.contact_name ?? "Unknown"}</p>
                    {c.notes && <p className="text-[10px] text-muted-foreground truncate">{c.notes}</p>}
                    <p className="text-[10px] text-muted-foreground/60">{formatDate(c.called_at)}</p>
                  </div>
                  {/* Type badge */}
                  <div>
                    {c.call_type === "manual" ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                        <Phone className="h-2.5 w-2.5" /> Manual
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/15 text-primary border border-primary/30">
                        <Bot className="h-2.5 w-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{c.phone_number ?? "—"}</span>
                  <div className="flex items-center gap-1">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", c.direction === "inbound" ? "bg-blue-400" : "bg-green-400")} />
                    <span className="text-xs capitalize">{c.direction}</span>
                  </div>
                  <span className="text-xs">{formatDuration(c.duration_seconds)}</span>
                  <div className="flex items-center gap-1">
                    <span className={cn("w-2 h-2 rounded-full shrink-0",
                      c.status === "completed" ? "bg-green-400" : c.status === "no_answer" ? "bg-red-400" : "bg-yellow-400")} />
                    <span className="text-[10px] capitalize">{c.status?.replace("_", " ") ?? "—"}</span>
                  </div>
                  {/* Recording player */}
                  <div>
                    {c.recording_url ? (
                      <audio controls src={c.recording_url} className="h-6 w-full max-w-[180px]" style={{ height: "24px" }} />
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">No recording</span>
                    )}
                  </div>
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

interface DashboardStats {
  summary: {
    new_leads_today: number;
    outbound_calls_today: number;
    inbound_calls_today: number;
    texts_today: number;
    texts_inbound_today: number;
    active_sms_sessions: number;
  };
  sms_deliverability: { delivered: number; undelivered: number };
  recent_calls: Array<{ id: number; contact_name: string; phone_number: string; direction: string; duration_seconds: number; status: string; called_at: string }>;
  sms_sessions: Array<{ id: number; contact_name: string; phone_number: string; status: string; created_at: string; msg_count: number; last_msg: string }>;
}

function fmtDuration(secs: number) {
  if (!secs) return "0s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function DashboardView({ contacts, onNav }: { contacts: Contact[]; onNav: (v: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/crm/dashboard-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = stats?.summary;
  const summaryCards = [
    { label: "Leads today",      value: s?.new_leads_today ?? 0,        icon: Users,        color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", nav: "contacts" },
    { label: "New texts",        value: s?.texts_today ?? 0,            icon: MessageSquare, color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",    nav: "ai_sms" },
    { label: "Outbound calls",   value: s?.outbound_calls_today ?? 0,   icon: PhoneCall,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", nav: "calls" },
    { label: "Inbound calls",    value: s?.inbound_calls_today ?? 0,    icon: PhoneIncoming, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20",   nav: "calls" },
  ];

  const delivered   = stats?.sms_deliverability.delivered ?? 0;
  const undelivered = stats?.sms_deliverability.undelivered ?? 0;
  const total = delivered + undelivered || 1;
  const pieData = [
    { name: "Delivered",   value: delivered },
    { name: "Undelivered", value: undelivered },
  ];
  const PIE_COLORS = ["#22c55e", "#ef4444"];

  // Build simple hourly chart data from sms_sessions (by hour of creation today)
  const hourlyMap: Record<number, { outbound: number; inbound: number }> = {};
  for (let h = 0; h <= 23; h++) hourlyMap[h] = { outbound: 0, inbound: 0 };
  stats?.sms_sessions.forEach((sess) => {
    try {
      const h = new Date(sess.created_at).getHours();
      hourlyMap[h].outbound += 1;
    } catch { /* noop */ }
  });
  const chartData = Object.entries(hourlyMap).map(([h, v]) => ({
    time: `${h}:00`,
    Outbound: v.outbound,
    Inbound: v.inbound,
  }));

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Today's overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); const token=localStorage.getItem("auth_token"); fetch(`${import.meta.env.VITE_API_URL||""}/api/crm/dashboard-stats`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(setStats).catch(()=>{}).finally(()=>setLoading(false)); }} className="gap-2">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className={cn("rounded-xl border p-4 cursor-pointer hover:opacity-80 transition-opacity", c.bg)} onClick={() => onNav(c.nav)}>
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={cn("h-5 w-5", c.color)} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-3xl font-bold">{loading ? "—" : c.value}</p>
            <p className={cn("text-xs mt-1 flex items-center gap-1", c.color)}>
              <ArrowRight className="h-3 w-3" /> Go to {c.label.split(" ").pop()}
            </p>
          </div>
        ))}
      </div>

      {/* SMS Deliverability + Volume */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4" /> SMS Deliverability</h2>
          {delivered + undelivered === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No messages sent yet</p>
          ) : (
            <>
              <div className="flex justify-center">
                <PieChart width={180} height={180}>
                  <Pie data={pieData} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <RechartTooltip formatter={(v: number) => [`${v} texts`, ""]} />
                </PieChart>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Delivered</span><span className="font-medium">{delivered} ({((delivered/total)*100).toFixed(0)}%)</span></div>
                <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Undelivered</span><span className="font-medium">{undelivered} ({((undelivered/total)*100).toFixed(0)}%)</span></div>
                <div className="flex justify-between border-t border-border/20 pt-1 mt-1"><span className="font-medium">Total</span><span className="font-medium">{total} texts</span></div>
              </div>
            </>
          )}
        </div>

        {/* Line chart */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> SMS Volume Today</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={3} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <RechartTooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Outbound" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Inbound"  stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Call History */}
      <div className="rounded-xl border border-border/30 bg-card/40 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <PhoneCall className="h-4 w-4" /> Call History
          <button onClick={() => onNav("calls")} className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </h2>
        {!stats?.recent_calls.length ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No calls logged yet</p>
        ) : (
          <div className="space-y-1">
            {stats.recent_calls.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-border/10 last:border-0">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  c.direction === "outbound" ? "bg-purple-500/15" : "bg-emerald-500/15")}>
                  {c.direction === "outbound"
                    ? <PhoneCall className="h-3.5 w-3.5 text-purple-400" />
                    : <PhoneIncoming className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.contact_name || c.phone_number}</p>
                  <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{fmtDuration(c.duration_seconds)}</p>
                  <p className="text-[10px] text-muted-foreground/60">{fmtTime(c.called_at)}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px] shrink-0",
                  c.direction === "outbound" ? "text-purple-400 border-purple-500/30" : "text-emerald-400 border-emerald-500/30")}>
                  {c.direction === "outbound" ? "↗ Outbound" : "↙ Inbound"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI SMS Sessions */}
      <div className="rounded-xl border border-border/30 bg-card/40 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> AI Text Follow-Ups
          <button onClick={() => onNav("ai_sms")} className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </h2>
        {!stats?.sms_sessions.length ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No AI text sessions yet</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/20">
                <th className="text-left pb-2 font-medium">Contact</th>
                <th className="text-left pb-2 font-medium">Last Message</th>
                <th className="text-right pb-2 font-medium">Msgs</th>
                <th className="text-right pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.sms_sessions.map((sess) => (
                <tr key={sess.id} className="border-b border-border/10 last:border-0">
                  <td className="py-2 pr-2 font-medium">{sess.contact_name}</td>
                  <td className="py-2 pr-2 text-muted-foreground truncate max-w-[180px]">{sess.last_msg || "—"}</td>
                  <td className="py-2 text-right">{sess.msg_count}</td>
                  <td className="py-2 text-right">
                    <Badge variant="outline" className={cn("text-[10px]",
                      sess.status === "active" ? "text-green-400 border-green-500/30" : "text-muted-foreground")}>
                      {sess.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Pipeline (Kanban) View ────────────────────────────────────────────────────

function PipelineView({ contacts, onStatusChange, onEdit, onDelete, onStartDialing }: {
  contacts: Contact[];
  onStatusChange: (id: number, status: string) => Promise<void>;
  onEdit: (c: Contact) => void;
  onDelete: (id: number) => void;
  onStartDialing?: (statusId: string) => void;
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
              <div key={status.id} className="w-64 shrink-0 flex flex-col gap-2">
                {/* Column header — Ringy style */}
                <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-card/40 border-b border-border/15">
                    <Clock className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground flex-1">Filter timezone</span>
                    <span className="text-[10px] text-muted-foreground">Calls today: 0</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", status.dot)} />
                    <span className="text-xs font-semibold flex-1">{status.label}</span>
                    <Badge className={cn("text-[9px] border px-1.5", status.color)}>{cols.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2 px-3 pb-2.5">
                    <button onClick={() => onStartDialing?.(status.id)}
                      className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors">
                      <Play className="h-3 w-3" /> START DIALING
                    </button>
                    <span className="text-[10px] text-muted-foreground shrink-0">Total leads: {cols.length}</span>
                  </div>
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

  // Call — ElevenLabs voice picker
  const ELEVEN_VOICES = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel — calm, professional (F)" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi — confident, energetic (F)" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella — warm, friendly (F)" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni — smooth, professional (M)" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli — bright, upbeat (F)" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh — deep, engaging (M)" },
    { id: "VR6AewLTigWG4xSOukaG", name: "Arnold — authoritative (M)" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam — narration, clear (M)" },
    { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam — energetic, conversational (M)" },
    { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum — confident, british (M)" },
    { id: "ODq5zmih8GrVes37Dy9p", name: "Patrick — assertive, american (M)" },
    { id: "piTKgcLEGmPE4e6mEKli", name: "Nicole — soft, friendly (F)" },
  ] as const;
  const [selectedVoiceId, setSelectedVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");

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
    action === "text"  ? !!selectedPrompt :     // AI text also requires a CRM prompt
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
            from_number: selectedPrompt?.phoneNumber ?? undefined,
            to_number: c.phone_number,
            contact_name: fullName(c),
            system_prompt: selectedPrompt?.content ?? undefined,
            elevenlabs_voice_id: selectedVoiceId,
          });
        } else if (action === "text") {
          // AI-powered text: Claude generates personalized opener, handles replies automatically
          await startAISMS({
            to_number: c.phone_number,
            system_prompt: selectedPrompt?.content ?? smsMessage,
            from_number: selectedPrompt?.phoneNumber ?? undefined,
            contact_id: c.id,
            contact_name: fullName(c),
          });
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

                {/* ElevenLabs Voice Picker */}
                <div className="rounded-xl border border-border/40 bg-background/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎙️</span>
                    <span className="text-xs font-semibold">AI Voice</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">Powered by ElevenLabs</span>
                  </div>
                  <select
                    value={selectedVoiceId}
                    onChange={e => setSelectedVoiceId(e.target.value)}
                    className="w-full rounded-lg border border-border/40 px-3 h-9 text-sm bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {ELEVEN_VOICES.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {action === "text" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border/30 bg-card/30 p-3 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Claude will craft a <strong className="text-foreground">personalized opening text</strong> for each lead using your CRM prompt. When they reply, AI automatically continues the conversation.
                  </p>
                </div>
                {/* Prompt picker — same as call tab */}
                <div className={cn("rounded-xl border p-4 space-y-3",
                  selectedPrompt ? "border-blue-500/30 bg-blue-500/5" : "border-yellow-500/40 bg-yellow-500/5")}>
                  <div className="flex items-center gap-2">
                    <BotMessageSquare className={cn("h-4 w-4 shrink-0", selectedPrompt ? "text-blue-400" : "text-yellow-400")} />
                    <span className={cn("text-xs font-semibold", selectedPrompt ? "text-foreground" : "text-yellow-400")}>
                      {selectedPrompt ? "AI Prompt selected" : "Select a prompt"}
                    </span>
                    {!selectedPrompt && <AlertCircle className="h-3.5 w-3.5 text-yellow-400 ml-auto" />}
                  </div>
                  {allPrompts.length === 0
                    ? <p className="text-[11px] text-yellow-400/80">No prompts yet — go to <strong>My Prompt</strong> and create one first.</p>
                    : <select value={selectedPromptId} onChange={e => setSelectedPromptId(e.target.value)}
                        className={cn("w-full rounded-lg border px-3 h-9 text-sm bg-background/60 focus:outline-none",
                          selectedPrompt ? "border-blue-500/30" : "border-yellow-500/30 text-yellow-400")}>
                        <option value="">— choose a prompt —</option>
                        {allPrompts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.direction})</option>)}
                      </select>
                  }
                  {selectedPrompt && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedPrompt.content?.slice(0, 90) ?? "No content"}…
                    </p>
                  )}
                </div>
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

// ── AI SMS Inbox View ─────────────────────────────────────────────────────────

function AISMSInboxView() {
  const [sessions, setSessions] = useState<AISMSSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeSession, setActiveSession] = useState<AISMSSession | null>(null);
  const [messages, setMessages] = useState<AISMSMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setLoading(true);
    listAISMSSessions()
      .then(d => setSessions(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const openSession = async (s: AISMSSession) => {
    setActiveSession(s);
    setLoadingMsgs(true);
    try {
      const msgs = await getAISMSMessages(s.id);
      setMessages(msgs);
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  };

  useEffect(() => {
    if (activeSession) {
      const iv = setInterval(async () => {
        try {
          const msgs = await getAISMSMessages(activeSession.id);
          setMessages(msgs);
        } catch { /* ignore */ }
      }, 5000);
      return () => clearInterval(iv);
    }
  }, [activeSession]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClose = async (s: AISMSSession) => {
    await closeAISMSSession(s.id).catch(() => {});
    refresh();
    if (activeSession?.id === s.id) { setActiveSession(null); setMessages([]); }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions list */}
      <div className="w-72 shrink-0 border-r border-border/30 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-card/20">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold">AI Conversations</span>
          </div>
          <button onClick={refresh} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/20">
          {loading && <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>}
          {!loading && sessions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No AI text conversations yet.</p>
              <p className="text-[11px] text-muted-foreground/60">Start one from AI Pulse → Text tab.</p>
            </div>
          )}
          {sessions.map(s => (
            <button key={s.id} onClick={() => openSession(s)}
              className={cn("w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/30",
                activeSession?.id === s.id && "bg-blue-500/10 border-l-2 border-blue-500")}>
              <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0 mt-0.5">
                {(s.contact_name ?? s.phone_number).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold truncate">{s.contact_name ?? s.phone_number}</p>
                  <Badge className={cn("text-[9px] px-1.5 border shrink-0",
                    s.status === "active" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30")}>
                    {s.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.last_message ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{s.message_count ?? 0} msgs · {s.phone_number}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation thread */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-blue-400" />
            </div>
            <p className="text-sm font-semibold">Select a conversation</p>
            <p className="text-xs text-muted-foreground">Pick an AI text thread from the left to view the full conversation.</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-card/20 shrink-0">
              <div>
                <p className="text-sm font-semibold">{activeSession.contact_name ?? activeSession.phone_number}</p>
                <p className="text-xs text-muted-foreground">{activeSession.phone_number} · from {activeSession.from_number}</p>
              </div>
              {activeSession.status === "active" && (
                <Button size="sm" variant="outline" onClick={() => handleClose(activeSession)}
                  className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10">
                  End Conversation
                </Button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingMsgs && <p className="text-xs text-muted-foreground text-center py-4">Loading messages…</p>}
              {messages.map(m => (
                <div key={m.id} className={cn("flex", m.role === "assistant" ? "justify-start" : "justify-end")}>
                  <div className={cn("max-w-xs rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "assistant"
                      ? "bg-secondary/40 text-foreground rounded-bl-sm"
                      : "bg-blue-500/80 text-white rounded-br-sm")}>
                    <p>{m.content}</p>
                    <p className={cn("text-[10px] mt-1", m.role === "assistant" ? "text-muted-foreground" : "text-blue-100/70")}>
                      {m.role === "assistant" ? "🤖 AI" : "👤 Lead"} · {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>

            {activeSession.status === "closed" && (
              <div className="px-5 py-3 border-t border-border/30 bg-secondary/10 text-center">
                <p className="text-xs text-muted-foreground">This conversation has been ended.</p>
              </div>
            )}
          </>
        )}
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
  const [pastCampaigns, setPastCampaigns] = useState<any[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignMsg, setCampaignMsg] = useState("");
  const [savingCampaign, setSavingCampaign] = useState(false);

  const fetchPast = async () => {
    setLoadingPast(true);
    try { setPastCampaigns(await listCampaignsCRM()); }
    catch { /* silent */ }
    finally { setLoadingPast(false); }
  };

  useEffect(() => { if (campaignTab === "past") fetchPast(); }, [campaignTab]);

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

  const handleSendSMS = async () => {
    if (!searchResults || searchResults.length === 0) return;
    const name = campaignName || `SMS Campaign ${new Date().toLocaleDateString()}`;
    setSavingCampaign(true);
    try {
      await createCampaignCRM({
        name,
        message: campaignMsg || "Hello #first_name!",
        campaign_type: "sms",
        status: "sent",
        leads_count: searchResults.length,
        filter_json: JSON.stringify({ dateFrom: cDateFrom, dateTo: cDateTo, search: cSearch }),
      });
      toast({ title: "Campaign saved", description: `${name} — ${searchResults.length} leads` });
      setCampaignTab("past");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setSavingCampaign(false); }
  };

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
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Campaign name</label>
                        <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. March Blast" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Message (optional)</label>
                        <Input value={campaignMsg} onChange={e => setCampaignMsg(e.target.value)} placeholder="Hey #first_name, ..." className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" disabled={savingCampaign} onClick={handleSendSMS} className="gap-1.5">
                        {savingCampaign ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Send SMS Campaign
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Send Email Campaign</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_80px_100px_80px_80px_100px_120px] gap-3 px-4 py-2 border-b border-border/20 bg-secondary/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Name</span><span>Type</span><span>Status</span><span>Leads</span><span>Sent</span><span>Response Rate</span><span>Date</span>
            </div>
            {loadingPast ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : pastCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/60">
                <Send className="h-8 w-8" />
                <p className="text-sm">No past campaigns yet</p>
                <p className="text-xs">Create your first campaign to get started</p>
              </div>
            ) : pastCampaigns.map((camp: any) => {
              const rr = camp.sent_count > 0 ? Math.round((camp.response_count / camp.sent_count) * 100) : 0;
              const statusColor = camp.status === "sent" ? "text-green-400 bg-green-500/10 border-green-500/30"
                : camp.status === "draft" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                : "text-muted-foreground bg-secondary/30 border-border/30";
              return (
                <div key={camp.id} className="grid grid-cols-[2fr_80px_100px_80px_80px_100px_120px] gap-3 px-4 py-3 border-b border-border/10 hover:bg-secondary/10 text-sm items-center">
                  <span className="font-medium truncate">{camp.name}</span>
                  <span className="text-muted-foreground capitalize">{camp.campaign_type ?? "sms"}</span>
                  <span><Badge className={cn("text-[10px] px-1.5 border", statusColor)}>{camp.status}</Badge></span>
                  <span className="text-muted-foreground">{camp.leads_count ?? 0}</span>
                  <span className="text-muted-foreground">{camp.sent_count ?? 0}</span>
                  <span className="text-muted-foreground">{rr}%</span>
                  <span className="text-muted-foreground text-xs">{camp.created_at ? new Date(camp.created_at).toLocaleDateString() : "—"}</span>
                </div>
              );
            })}
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
                <div className="overflow-x-auto rounded-xl border border-border/20">
                  {/* Table header */}
                  <div className="grid grid-cols-[1.5fr_90px_80px_130px_120px_100px_60px] gap-2 px-4 py-2 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/20">
                    <span>Phone Number</span>
                    <span className="text-center">SMS Enabled</span>
                    <span>State</span>
                    <span>Next Renewal</span>
                    <span>Carrier Violations</span>
                    <span>Status</span>
                    <span></span>
                  </div>
                  {myNumbers.map((num, i) => {
                    const renewalDate = num.purchased_at
                      ? (() => { const d = new Date(num.purchased_at); d.setFullYear(d.getFullYear() + 1); return d; })()
                      : null;
                    return (
                      <div key={num.twilio_sid ?? num.phone_number ?? i}
                        className="grid grid-cols-[1.5fr_90px_80px_130px_120px_100px_60px] gap-2 px-4 py-3 border-b border-border/10 hover:bg-secondary/10 items-center text-sm">
                        {/* Phone number */}
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold">{num.phone_number}</span>
                        </div>
                        {/* SMS enabled */}
                        <div className="flex justify-center">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        </div>
                        {/* State */}
                        <span className="text-muted-foreground text-xs">{(num as any).state ?? "—"}</span>
                        {/* Next renewal */}
                        <span className="text-muted-foreground text-xs">
                          {renewalDate ? renewalDate.toLocaleDateString() : "—"}
                        </span>
                        {/* Carrier violations */}
                        <div className="flex justify-center">
                          <span className={cn("text-xs font-medium", ((num as any).violations ?? 0) > 0 ? "text-red-400" : "text-muted-foreground")}>
                            {(num as any).violations ?? 0}
                          </span>
                        </div>
                        {/* Status badge */}
                        <Badge className="text-[10px] px-1.5 border border-green-500/30 text-green-400 bg-green-500/10 w-fit">Active</Badge>
                        {/* MORE / delete */}
                        <div className="flex items-center gap-1">
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
                    );
                  })}
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
          <div className="grid grid-cols-[32px_48px_2fr_3fr_1fr] gap-4 px-6 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground bg-card/10 shrink-0">
            <button onClick={() => { if (allChecked) setCheckedIds(new Set()); else setCheckedIds(new Set(pagedContacts.map(c => c.id))); }}>
              {allChecked ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
            </button>
            <span />
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
                    className={cn("grid grid-cols-[32px_48px_2fr_3fr_1fr] gap-4 px-6 py-3 border-b border-border/10 items-center cursor-pointer transition-colors",
                      isChecked ? "bg-primary/5" : "hover:bg-secondary/20",
                      selected?.id === c.id && "bg-primary/8")}>
                    <button onClick={(e) => { e.stopPropagation(); toggleCheck(c.id); }}>
                      {isChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {/* Disposition tag */}
                    <div className="flex items-center justify-center" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <Badge className={cn("text-[9px] px-1.5 py-0.5 border font-semibold whitespace-nowrap", sm.color)}>{sm.label.split(" ")[0]}</Badge>
                    </div>
                    {/* From */}
                    <div className="flex items-center gap-2 min-w-0" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">{initials(c)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{fullName(c)}</p>
                        <p className="text-xs text-primary/80 truncate">{msgType === "sms" ? c.phone_number : (c.email ?? c.phone_number)}</p>
                      </div>
                    </div>
                    {/* Message preview */}
                    <div className="flex items-center gap-2 min-w-0" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <ArrowLeft className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">
                        {c.notes ? c.notes.slice(0, 80) : `Tap to view ${msgType === "sms" ? "SMS" : "email"} thread…`}
                      </p>
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
              <div className="flex items-center gap-1.5 pr-6">
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
              {/* Delete button — visible on hover */}
              <button
                onClick={e => { e.stopPropagation(); deletePrompt(p.id); }}
                title="Delete prompt"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all">
                <Trash2 className="h-3.5 w-3.5" />
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
                <Button
                  variant="ghost" size="sm"
                  onClick={() => deletePrompt(selected.id)}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
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

// ── SMS Marketing View ────────────────────────────────────────────────────────

const SMS_KEYWORDS_LIST = ["#first_name","#last_name","#full_name","#email_address","#city","#state","#zip_code","#birthday","#my_first_name","#my_last_name","#my_email","#my_company_name","#new_line"];

function SMSMarketingView() {
  const [tab, setTab] = useState<"preset_texts"|"drip"|"keywords"|"preset_replies">("preset_texts");
  const [presetType, setPresetType] = useState("initial");

  // Preset Texts
  const [presetTexts, setPresetTexts] = useState<any[]>([]);
  const [ptMsg, setPtMsg] = useState("");
  const [ptSaving, setPtSaving] = useState(false);
  const [ptIncludeOptout, setPtIncludeOptout] = useState(true);

  // Drip
  const [drips, setDrips] = useState<any[]>([]);
  const [dripName, setDripName] = useState("");
  const [dripDays, setDripDays] = useState(1);
  const [dripTime, setDripTime] = useState("08:00");
  const [dripMsg, setDripMsg] = useState("");
  const [dripSaving, setDripSaving] = useState(false);

  // Keywords
  const [kwds, setKwds] = useState<any[]>([]);
  const [kwWord, setKwWord] = useState("");
  const [kwReply, setKwReply] = useState("");
  const [kwSaving, setKwSaving] = useState(false);

  // Preset Replies
  const [replies, setReplies] = useState<any[]>([]);
  const [rpTitle, setRpTitle] = useState("");
  const [rpMsg, setRpMsg] = useState("");
  const [rpShortcut, setRpShortcut] = useState("");
  const [rpSaving, setRpSaving] = useState(false);

  useEffect(() => {
    listPresetTexts().then(setPresetTexts).catch(() => {});
    listDripSequences().then(setDrips).catch(() => {});
    listKeywords().then(setKwds).catch(() => {});
    listPresetReplies().then(setReplies).catch(() => {});
  }, []);

  const PRESET_TYPES = [
    { id: "initial", label: "Initial Preset Texts" },
    { id: "away", label: "Initial Preset Text While Away" },
    { id: "follow_up", label: "Presentation Follow Up Preset Text" },
    { id: "birthday", label: "Birthday Preset Text" },
    { id: "verification", label: "Verification Reminder Preset Text" },
  ];

  const filteredPresets = presetTexts.filter(p => p.preset_type === presetType);

  const savePresetText = async () => {
    if (!ptMsg.trim()) return;
    setPtSaving(true);
    try {
      const r = await createPresetText({ preset_type: presetType, message: ptMsg, include_optout: ptIncludeOptout ? 1 : 0 });
      setPresetTexts(prev => [...prev, { id: r.id, preset_type: presetType, message: ptMsg, is_active: 1, include_optout: ptIncludeOptout ? 1 : 0 }]);
      setPtMsg("");
      toast({ title: "Preset text saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setPtSaving(false); }
  };

  const saveDrip = async () => {
    if (!dripName.trim() || !dripMsg.trim()) return;
    setDripSaving(true);
    try {
      const r = await createDripSequence({ name: dripName, days_after: dripDays, send_time: dripTime, message: dripMsg });
      setDrips(prev => [...prev, { id: r.id, name: dripName, days_after: dripDays, send_time: dripTime, message: dripMsg, is_active: 1 }]);
      setDripName(""); setDripMsg(""); setDripDays(1); setDripTime("08:00");
      toast({ title: "Drip sequence saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setDripSaving(false); }
  };

  const saveKeyword = async () => {
    if (!kwWord.trim() || !kwReply.trim()) return;
    setKwSaving(true);
    try {
      const r = await createKeyword({ keyword: kwWord, auto_reply: kwReply });
      setKwds(prev => [...prev, { id: r.id, keyword: kwWord.toUpperCase(), auto_reply: kwReply, is_active: 1 }]);
      setKwWord(""); setKwReply("");
      toast({ title: "Keyword saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setKwSaving(false); }
  };

  const saveReply = async () => {
    if (!rpTitle.trim() || !rpMsg.trim()) return;
    setRpSaving(true);
    try {
      const r = await createPresetReply({ title: rpTitle, message: rpMsg, shortcut: rpShortcut || undefined });
      setReplies(prev => [...prev, { id: r.id, title: rpTitle, message: rpMsg, shortcut: rpShortcut }]);
      setRpTitle(""); setRpMsg(""); setRpShortcut("");
      toast({ title: "Reply saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setRpSaving(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold flex-1">SMS Marketing</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0 overflow-x-auto">
        {([
          { id: "preset_texts", label: "Preset Texts" },
          { id: "drip", label: "Drip Marketing" },
          { id: "keywords", label: "Keywords" },
          { id: "preset_replies", label: "Preset Replies" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-6 py-3 text-sm font-medium border-b-2 transition-all uppercase tracking-wide whitespace-nowrap",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Preset Texts ─────────────────────────────────────────── */}
        {tab === "preset_texts" && (
          <>
            {/* Left sidebar */}
            <div className="w-64 border-r border-border/20 overflow-y-auto shrink-0">
              {PRESET_TYPES.map(pt => (
                <button key={pt.id} onClick={() => setPresetType(pt.id)}
                  className={cn("w-full text-left px-4 py-3 text-xs font-medium border-b border-border/10 transition-colors uppercase tracking-wide",
                    presetType === pt.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground")}>
                  {pt.label}
                </button>
              ))}
            </div>
            {/* Right content */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">{PRESET_TYPES.find(p => p.id === presetType)?.label}</h2>
              </div>
              <p className="text-xs text-muted-foreground">Send new leads a text when they come into the system. If you set multiple templates, we'll choose a different one each time.</p>
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-300">
                Per CTIA guidelines, you must include the name of the company you represent and your name in this first text message.
              </div>
              {/* Existing presets */}
              {filteredPresets.map(p => (
                <div key={p.id} className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm flex-1">{p.message}</p>
                    <button onClick={async () => { await deletePresetText(p.id); setPresetTexts(prev => prev.filter(x => x.id !== p.id)); }}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.message.length}/800 (1 text message)</p>
                </div>
              ))}
              {/* New message form */}
              <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
                <Textarea value={ptMsg} onChange={e => setPtMsg(e.target.value)} placeholder="Message" rows={4} className="text-sm resize-none" maxLength={800} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ptMsg.length}/800 (1 text message)</span>
                  <span>Estimated cost: $0.01</span>
                </div>
                <p className="text-xs text-muted-foreground">Opt-out notice: Reply 1 for quote OR end to opt-out.</p>
                <div className="flex flex-wrap gap-1.5">
                  {SMS_KEYWORDS_LIST.slice(0,8).map(k => (
                    <button key={k} onClick={() => setPtMsg(m => m + k)}
                      className="px-2 py-0.5 rounded-md bg-secondary/40 text-[10px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors font-mono">
                      {k}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setPtIncludeOptout(v => !v)}
                    className={cn("w-8 h-4 rounded-full relative transition-colors", ptIncludeOptout ? "bg-primary" : "bg-secondary/60")}>
                    <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all", ptIncludeOptout ? "left-4" : "left-0.5")} />
                  </div>
                  <span className="text-xs text-muted-foreground">Include opt-out notice in estimated cost?</span>
                </label>
                <Button size="sm" onClick={savePresetText} disabled={ptSaving || !ptMsg.trim()} className="gap-1.5">
                  {ptSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Save Preset
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Drip Marketing ───────────────────────────────────────── */}
        {tab === "drip" && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple-400" /> Drip Marketing</h2>
            </div>
            <p className="text-xs text-muted-foreground">Automatically send follow-up texts X days after a lead is created.</p>
            {/* Existing drips */}
            {drips.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
                <div className="grid grid-cols-[2fr_80px_80px_3fr_80px] gap-4 px-4 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground">
                  <span>Name</span><span>Days</span><span>Time</span><span>Message</span><span></span>
                </div>
                {drips.map(d => (
                  <div key={d.id} className="grid grid-cols-[2fr_80px_80px_3fr_80px] gap-4 px-4 py-3 border-b border-border/10 items-center text-xs">
                    <span className="font-medium truncate">{d.name}</span>
                    <span>Day {d.days_after}</span>
                    <span>{d.send_time}</span>
                    <span className="truncate text-muted-foreground">{d.message}</span>
                    <button onClick={async () => { await deleteDripSequence(d.id); setDrips(prev => prev.filter(x => x.id !== d.id)); }}
                      className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            {/* New drip form */}
            <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add Drip Sequence</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input value={dripName} onChange={e => setDripName(e.target.value)} placeholder="General follow up" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Days after lead created</label>
                  <Input type="number" min={1} max={365} value={dripDays} onChange={e => setDripDays(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Send time</label>
                  <Input type="time" value={dripTime} onChange={e => setDripTime(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <Textarea value={dripMsg} onChange={e => setDripMsg(e.target.value)} placeholder="Hi #first_name, just following up…" rows={3} className="text-sm resize-none" />
              <div className="flex flex-wrap gap-1">
                {SMS_KEYWORDS_LIST.slice(0,6).map(k => (
                  <button key={k} onClick={() => setDripMsg(m => m + k)} className="px-2 py-0.5 rounded-md bg-secondary/40 text-[10px] font-mono text-muted-foreground hover:bg-secondary/70">{k}</button>
                ))}
              </div>
              <Button size="sm" onClick={saveDrip} disabled={dripSaving || !dripName.trim() || !dripMsg.trim()} className="gap-1.5">
                {dripSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Drip
              </Button>
            </div>
          </div>
        )}

        {/* ── Keywords ─────────────────────────────────────────────── */}
        {tab === "keywords" && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-400" /> Auto-Reply Keywords</h2>
            <p className="text-xs text-muted-foreground">When a lead texts a specific keyword, automatically reply with a preset message.</p>
            {kwds.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
                <div className="grid grid-cols-[1fr_3fr_40px] gap-4 px-4 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground">
                  <span>Keyword</span><span>Auto-Reply</span><span></span>
                </div>
                {kwds.map(k => (
                  <div key={k.id} className="grid grid-cols-[1fr_3fr_40px] gap-4 px-4 py-3 border-b border-border/10 items-center text-xs">
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/30 w-fit font-mono">{k.keyword}</Badge>
                    <span className="text-muted-foreground">{k.auto_reply}</span>
                    <button onClick={async () => { await deleteKeyword(k.id); setKwds(prev => prev.filter(x => x.id !== k.id)); }}
                      className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add Keyword</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Keyword (e.g. STOP, INFO, YES)</label>
                  <Input value={kwWord} onChange={e => setKwWord(e.target.value.toUpperCase())} placeholder="STOP" className="h-8 text-xs font-mono uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Auto-Reply Message</label>
                  <Input value={kwReply} onChange={e => setKwReply(e.target.value)} placeholder="You have been unsubscribed." className="h-8 text-xs" />
                </div>
              </div>
              <Button size="sm" onClick={saveKeyword} disabled={kwSaving || !kwWord.trim() || !kwReply.trim()} className="gap-1.5">
                {kwSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Keyword
              </Button>
            </div>
          </div>
        )}

        {/* ── Preset Replies ───────────────────────────────────────── */}
        {tab === "preset_replies" && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2"><Send className="h-5 w-5 text-blue-400" /> Preset Replies</h2>
            <p className="text-xs text-muted-foreground">Saved canned responses for quick sending during conversations.</p>
            {replies.length > 0 && (
              <div className="space-y-2">
                {replies.map(r => (
                  <div key={r.id} className="rounded-xl border border-border/30 bg-card/40 p-4 flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{r.title}</p>
                        {r.shortcut && <Badge className="text-[9px] bg-secondary/40 text-muted-foreground border-border/30 font-mono">{r.shortcut}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{r.message}</p>
                    </div>
                    <button onClick={async () => { await deletePresetReply(r.id); setReplies(prev => prev.filter(x => x.id !== r.id)); }}
                      className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add Preset Reply</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Title</label>
                  <Input value={rpTitle} onChange={e => setRpTitle(e.target.value)} placeholder="Appointment Confirmation" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Shortcut (optional)</label>
                  <Input value={rpShortcut} onChange={e => setRpShortcut(e.target.value)} placeholder="/appt" className="h-8 text-xs font-mono" />
                </div>
              </div>
              <Textarea value={rpMsg} onChange={e => setRpMsg(e.target.value)} placeholder="Your appointment is confirmed for…" rows={3} className="text-sm resize-none" />
              <Button size="sm" onClick={saveReply} disabled={rpSaving || !rpTitle.trim() || !rpMsg.trim()} className="gap-1.5">
                {rpSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Save Reply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lead Vendors View ─────────────────────────────────────────────────────────

function LeadVendorsView() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    listLeadVendors().then(v => setVendors(Array.isArray(v) ? v : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await createLeadVendor({ name: newName });
      setVendors(prev => [...prev, { id: r.id, name: newName, vendor_type: "personal_leads", status: "verified", webhook_token: r.webhook_token, email_address: r.email_address }]);
      setNewName(""); setShowForm(false);
      toast({ title: `Lead vendor "${newName}" created` });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleEdit = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await updateLeadVendor(id, { name: editName });
      setVendors(prev => prev.map(v => v.id === id ? { ...v, name: editName } : v));
      setEditId(null);
      toast({ title: "Vendor updated" });
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this vendor?")) return;
    try {
      await deleteLeadVendor(id);
      setVendors(prev => prev.filter(v => v.id !== id));
      toast({ title: "Vendor deleted" });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold flex-1">Lead Vendors</h1>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Lead Vendor
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {showForm && (
          <div className="rounded-xl border border-border/30 bg-card/40 p-4 mb-4 flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Vendor Name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Facebook Leads, USHA, NextGen" className="h-8 text-sm" autoFocus />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saving || !newName.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setNewName(""); }}>Cancel</Button>
          </div>
        )}

        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_2fr_100px] gap-4 px-6 py-3 border-b border-border/20 text-xs font-medium text-muted-foreground">
            <span>Name</span><span>Type</span><span>Status</span><span>Manage Integration</span><span></span>
          </div>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading vendors…
            </div>
          ) : vendors.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
              <Globe className="h-10 w-10 mx-auto opacity-20" />
              <p>No lead vendors yet</p>
              <p className="text-xs">Add a vendor to track where your leads come from</p>
            </div>
          ) : vendors.map(v => (
            <div key={v.id} className="grid grid-cols-[2fr_1fr_1fr_2fr_100px] gap-4 px-6 py-4 border-b border-border/10 items-center">
              {editId === v.id ? (
                <div className="flex items-center gap-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" autoFocus />
                  <button onClick={() => handleEdit(v.id)} className="text-primary hover:text-primary/80 text-xs font-medium">Save</button>
                  <button onClick={() => setEditId(null)} className="text-muted-foreground text-xs">Cancel</button>
                </div>
              ) : (
                <span className="text-sm font-medium">{v.name}</span>
              )}
              <span className="text-xs text-muted-foreground capitalize">{(v.vendor_type || "personal_leads").replace(/_/g, " ")}</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs text-green-400 font-medium">Verified</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {v.email_address && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate font-mono text-[10px]">{v.email_address}</span>
                  </div>
                )}
                <button onClick={() => { toast({ title: "Webhook URL copied!", description: `Token: ${v.webhook_token}` }); }}
                  className="text-primary hover:underline text-[10px]">EMAIL SETUP INSTRUCTIONS</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditId(v.id); setEditName(v.name); }} className="text-muted-foreground hover:text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(v.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Email Marketing View ───────────────────────────────────────────────────────

const EMAIL_PRESET_TYPES = [
  { id: "initial",    label: "Initial Preset Email",    desc: "Send new leads an email when they come into the system." },
  { id: "follow_up1", label: "Follow Up #1",             desc: "First follow-up email after initial contact." },
  { id: "follow_up2", label: "Follow Up #2",             desc: "Second follow-up email." },
  { id: "follow_up3", label: "Follow Up #3",             desc: "Third follow-up email." },
  { id: "closing",    label: "Closing Email",            desc: "Final email to close the deal." },
] as const;

const EMAIL_KEYWORDS = [
  "#first_name","#last_name","#full_name","#email_address","#phone_number",
  "#street_address","#city","#state","#zip_code","#my_email",
  "#my_office_phone_number","#my_forwarding_number","#my_first_name",
  "#my_last_name","#my_full_name","#my_business_website","#my_booking_link",
  "#my_producer_link","#next_month_full_name",
];

function EmailMarketingView() {
  const [emailTab, setEmailTab] = useState<"preset_email" | "drip" | "preset_replies" | "settings">("preset_email");
  const [selectedType, setSelectedType] = useState<string>("initial");
  const [presets, setPresets] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  // Drip
  const [drips, setDrips] = useState<any[]>([]);
  const [dripForm, setDripForm] = useState({ name: "", days_after: 1, send_time: "08:00", subject: "", message: "", disposition_filter: "" });
  const [addingDrip, setAddingDrip] = useState(false);
  const [savingDrip, setSavingDrip] = useState(false);

  // Preset replies
  const [replies, setReplies] = useState<any[]>([]);
  const [replyForm, setReplyForm] = useState({ title: "", subject: "", message: "", shortcut: "" });
  const [addingReply, setAddingReply] = useState(false);
  const [savingReply, setSavingReply] = useState(false);

  useEffect(() => {
    listEmailPresetTexts().then(setPresets).catch(() => {});
    listEmailDripSequences().then(setDrips).catch(() => {});
    listEmailPresetReplies().then(setReplies).catch(() => {});
  }, []);

  useEffect(() => {
    const existing = presets.find((p: any) => p.preset_type === selectedType);
    setSubject(existing?.subject ?? "");
    setBody(existing?.message ?? "");
  }, [selectedType, presets]);

  const handleSavePreset = async () => {
    setSaving(true);
    try {
      const existing = presets.find((p: any) => p.preset_type === selectedType);
      if (existing) {
        await updateEmailPresetText(existing.id, { preset_type: selectedType, subject, message: body });
      } else {
        const r = await createEmailPresetText({ preset_type: selectedType, subject, message: body });
        setPresets(prev => [...prev, { id: r.id, preset_type: selectedType, subject, message: body }]);
      }
      toast({ title: "Saved", description: `${EMAIL_PRESET_TYPES.find(t => t.id === selectedType)?.label} saved.` });
      const fresh = await listEmailPresetTexts();
      setPresets(fresh);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeletePreset = async () => {
    const existing = presets.find((p: any) => p.preset_type === selectedType);
    if (!existing) return;
    await deleteEmailPresetText(existing.id);
    setPresets(prev => prev.filter((p: any) => p.id !== existing.id));
    setSubject(""); setBody("");
    toast({ title: "Deleted" });
  };

  const handleSaveDrip = async () => {
    setSavingDrip(true);
    try {
      await createEmailDripSequence(dripForm);
      const fresh = await listEmailDripSequences();
      setDrips(fresh);
      setDripForm({ name: "", days_after: 1, send_time: "08:00", subject: "", message: "", disposition_filter: "" });
      setAddingDrip(false);
      toast({ title: "Drip sequence added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingDrip(false); }
  };

  const handleSaveReply = async () => {
    setSavingReply(true);
    try {
      await createEmailPresetReply(replyForm);
      const fresh = await listEmailPresetReplies();
      setReplies(fresh);
      setReplyForm({ title: "", subject: "", message: "", shortcut: "" });
      setAddingReply(false);
      toast({ title: "Preset reply added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingReply(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5 text-blue-400" />
        </div>
        <h1 className="text-lg font-bold flex-1">Email Marketing</h1>
      </div>

      <div className="flex border-b border-border/20 shrink-0">
        {([
          { id: "preset_email", label: "Preset Email" },
          { id: "drip", label: "Drip Marketing" },
          { id: "preset_replies", label: "Preset Replies" },
          { id: "settings", label: "Settings" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setEmailTab(t.id)}
            className={cn("px-8 py-3 text-sm font-medium border-b-2 transition-all uppercase tracking-wide",
              emailTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {emailTab === "preset_email" && (
          <div className="flex h-full">
            {/* Left sidebar — preset types */}
            <div className="w-52 shrink-0 border-r border-border/20 bg-card/20 p-3 space-y-1">
              {EMAIL_PRESET_TYPES.map(t => (
                <button key={t.id} onClick={() => setSelectedType(t.id)}
                  className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all",
                    selectedType === t.id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground")}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Main editor */}
            <div className="flex-1 p-6 space-y-5 overflow-auto">
              {(() => {
                const meta = EMAIL_PRESET_TYPES.find(t => t.id === selectedType)!;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                        <Mail className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">{meta.label}</h2>
                        <p className="text-xs text-muted-foreground">{meta.desc}</p>
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Subject</label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)}
                        placeholder="e.g. Custom tailored health coverage for your needs and budget!"
                        className="h-9 text-sm" />
                    </div>

                    {/* Available keywords */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Available keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {EMAIL_KEYWORDS.map(kw => (
                          <button key={kw} onClick={() => setBody(prev => prev + kw)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono">
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Body editor */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Email Body</label>
                      <Textarea value={body} onChange={e => setBody(e.target.value)}
                        placeholder={`Hi #first_name,\n\nYour email body here...`}
                        className="min-h-[280px] text-sm font-mono resize-y" />
                      <p className="text-[10px] text-muted-foreground">Click a keyword chip above to insert it at the end, or type keywords directly in the body.</p>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSavePreset} disabled={saving} className="gap-1.5">
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDeletePreset} className="gap-1.5 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {emailTab === "drip" && (
          <div className="p-6 space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Drip Marketing Sequences</h2>
              <Button size="sm" onClick={() => setAddingDrip(!addingDrip)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Sequence
              </Button>
            </div>

            {addingDrip && (
              <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
                <h3 className="text-sm font-medium">New Drip Email</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="Sequence name" value={dripForm.name} onChange={e => setDripForm(f => ({...f, name: e.target.value}))} className="h-8 text-sm" />
                  <Input type="number" min={1} placeholder="Days after" value={dripForm.days_after} onChange={e => setDripForm(f => ({...f, days_after: +e.target.value}))} className="h-8 text-sm" />
                  <Input type="time" value={dripForm.send_time} onChange={e => setDripForm(f => ({...f, send_time: e.target.value}))} className="h-8 text-sm" />
                </div>
                <Input placeholder="Subject" value={dripForm.subject} onChange={e => setDripForm(f => ({...f, subject: e.target.value}))} className="h-8 text-sm" />
                <Textarea placeholder="Email body..." value={dripForm.message} onChange={e => setDripForm(f => ({...f, message: e.target.value}))} className="min-h-[100px] text-sm resize-y" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveDrip} disabled={savingDrip}>
                    {savingDrip ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingDrip(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {drips.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/60">
                <Mail className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No drip sequences yet</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
                <div className="grid grid-cols-[2fr_80px_80px_3fr_60px] gap-3 px-4 py-2 bg-secondary/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/20">
                  <span>Name</span><span>Days After</span><span>Send Time</span><span>Subject</span><span></span>
                </div>
                {drips.map((d: any) => (
                  <div key={d.id} className="grid grid-cols-[2fr_80px_80px_3fr_60px] gap-3 px-4 py-3 border-b border-border/10 hover:bg-secondary/10 text-sm items-center">
                    <span className="font-medium truncate">{d.name}</span>
                    <span className="text-muted-foreground">Day {d.days_after}</span>
                    <span className="text-muted-foreground">{d.send_time}</span>
                    <span className="text-muted-foreground text-xs truncate">{d.subject || "—"}</span>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      onClick={async () => { await deleteEmailDripSequence(d.id); setDrips(prev => prev.filter((x: any) => x.id !== d.id)); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {emailTab === "preset_replies" && (
          <div className="p-6 space-y-4 max-w-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Preset Replies</h2>
              <Button size="sm" onClick={() => setAddingReply(!addingReply)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Reply
              </Button>
            </div>

            {addingReply && (
              <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Title" value={replyForm.title} onChange={e => setReplyForm(f => ({...f, title: e.target.value}))} className="h-8 text-sm" />
                  <Input placeholder="Shortcut (optional)" value={replyForm.shortcut} onChange={e => setReplyForm(f => ({...f, shortcut: e.target.value}))} className="h-8 text-sm" />
                </div>
                <Input placeholder="Subject" value={replyForm.subject} onChange={e => setReplyForm(f => ({...f, subject: e.target.value}))} className="h-8 text-sm" />
                <Textarea placeholder="Reply body..." value={replyForm.message} onChange={e => setReplyForm(f => ({...f, message: e.target.value}))} className="min-h-[80px] text-sm resize-y" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveReply} disabled={savingReply}>
                    {savingReply ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingReply(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {replies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/60">
                <Mail className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No preset replies yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {replies.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/20 bg-card/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{r.title}</p>
                        {r.shortcut && <code className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">{r.shortcut}</code>}
                      </div>
                      {r.subject && <p className="text-xs text-primary/80 mt-0.5">Subject: {r.subject}</p>}
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.message}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0 shrink-0"
                      onClick={async () => { await deleteEmailPresetReply(r.id); setReplies(prev => prev.filter((x: any) => x.id !== r.id)); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {emailTab === "settings" && (
          <div className="p-6 space-y-4 max-w-xl">
            <h2 className="text-base font-semibold">Email Settings</h2>
            <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Reply-to email address</label>
                <Input placeholder="your@email.com" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Sender name</label>
                <Input placeholder="Your name or company" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Stop emailing leads at</label>
                <select className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm appearance-none">
                  {["8 PM","9 PM","10 PM","11 PM","Never"].map(v => <option key={v}>{v} in their respective time zones</option>)}
                </select>
              </div>
              <Button size="sm">Save Settings</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Account Settings View ──────────────────────────────────────────────────────

const ACCOUNT_SETTINGS_SIDEBAR = [
  { id: "general",    label: "General Info",     icon: User },
  { id: "2fa",        label: "2FA",              icon: Lock },
  { id: "password",   label: "Change Password",  icon: Lock },
  { id: "notifs",     label: "Notifications",    icon: Bell },
  { id: "states",     label: "Business States",  icon: MapPin },
  { id: "vcard",      label: "VCard",            icon: Contact },
  { id: "sync",       label: "Sync Account",     icon: RefreshCcw },
] as const;

type AccountTab = typeof ACCOUNT_SETTINGS_SIDEBAR[number]["id"];

const TIMEZONES = ["Eastern","Central","Mountain","Pacific","Alaska","Hawaii"];
const STOP_TIMES = ["8 PM","9 PM","10 PM","11 PM","Never"];

function AccountSettingsView() {
  const [activeTab, setActiveTab] = useState<AccountTab>("general");
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAccountProfile().then(p => { setProfile(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const set = (key: string, val: any) => setProfile((p: any) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAccountProfile(profile);
      toast({ title: "Profile saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-bold flex-1">Account Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-52 shrink-0 border-r border-border/20 bg-card/20 p-3 space-y-0.5 overflow-auto">
          {ACCOUNT_SETTINGS_SIDEBAR.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                activeTab === id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-6 max-w-2xl">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm pt-10">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : activeTab === "general" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary">
                  {profile.first_name?.[0] ?? profile.email?.[0] ?? "U"}
                </div>
                <div>
                  <h2 className="text-base font-semibold">General Info</h2>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">First name</label>
                    <Input value={profile.first_name ?? ""} onChange={e => set("first_name", e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Last name</label>
                    <Input value={profile.last_name ?? ""} onChange={e => set("last_name", e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Forward calls to</label>
                    <Input value={profile.forward_calls_to ?? ""} onChange={e => set("forward_calls_to", e.target.value)} placeholder="e.g. 786-218-2384" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Default time zone</label>
                    <select value={profile.default_timezone ?? "Eastern"} onChange={e => set("default_timezone", e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm appearance-none">
                      {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Agent website</label>
                    <Input value={profile.agent_website ?? ""} onChange={e => set("agent_website", e.target.value)} placeholder="https://yoursite.com" className="h-9 text-sm" />
                    <p className="text-[10px] text-muted-foreground">Used for SMS/email templates via #my_business_website</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Agent ID</label>
                    <Input value={profile.agent_id_str ?? ""} onChange={e => set("agent_id_str", e.target.value)} placeholder="Exported with reports" className="h-9 text-sm" />
                    <p className="text-[10px] text-muted-foreground">This can be exported with your reports</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Stop texting my leads for the night at</label>
                  <select value={profile.stop_texting_at ?? "10 PM"} onChange={e => set("stop_texting_at", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm appearance-none">
                    {STOP_TIMES.map(t => <option key={t}>{t} in their respective time zones</option>)}
                  </select>
                </div>
              </div>

              {/* Preferences + System alerts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Preferences</h3>
                  {([
                    { key: "pref_dark_mode", label: "Dark mode." },
                    { key: "pref_auto_save_notes", label: "Auto-save my lead notes." },
                    { key: "pref_keep_recording", label: "Keep call recording turned on." },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={!!profile[key]} onChange={e => set(key, e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded accent-primary" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">System alerts</h3>
                  {([
                    { key: "alert_new_lead", label: "Show system alerts each time a new lead comes in." },
                    { key: "alert_new_text", label: "Show system alerts each time a new text message comes in." },
                    { key: "alert_missed_call", label: "Show system alerts each time I receive a missed call." },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={!!profile[key]} onChange={e => set(key, e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded accent-primary" />
                      <span className="text-sm text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          ) : activeTab === "password" ? (
            <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
              <h2 className="text-base font-semibold">Change Password</h2>
              {["Current password", "New password", "Confirm new password"].map(f => (
                <div key={f} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{f}</label>
                  <Input type="password" placeholder={f} className="h-9 text-sm" />
                </div>
              ))}
              <Button size="sm">Update Password</Button>
            </div>
          ) : activeTab === "notifs" ? (
            <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
              <h2 className="text-base font-semibold">Notifications</h2>
              <p className="text-sm text-muted-foreground">Configure how you want to receive notifications for important events.</p>
              {[
                "Email me when a new lead comes in",
                "Email me when a lead is marked Closed Won",
                "Push notification for incoming calls",
                "Daily summary email",
              ].map(n => (
                <label key={n} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded accent-primary" defaultChecked />
                  <span className="text-sm">{n}</span>
                </label>
              ))}
              <Button size="sm">Save Notifications</Button>
            </div>
          ) : activeTab === "states" ? (
            <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
              <h2 className="text-base font-semibold">Business States</h2>
              <p className="text-sm text-muted-foreground">Select the states where you are licensed to do business.</p>
              <div className="grid grid-cols-5 gap-2">
                {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" />
                    <span className="text-xs">{s}</span>
                  </label>
                ))}
              </div>
              <Button size="sm">Save States</Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/50">
              <Settings className="h-10 w-10" />
              <p className="text-sm">Coming soon</p>
            </div>
          )}
        </div>
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
    { id: "ai_sms",       label: "AI Texts",      icon: MessageSquare, badge: "AI" },
    { id: "inbox",        label: "Inbox",         icon: Inbox },
    { id: "pipeline",     label: "Sales Pipeline",icon: Columns3 },
    { id: "calendar",     label: "Google Calendar",icon: Calendar },
    { id: "reports",      label: "Reports",       icon: BarChart3 },
    { id: "campaigns",      label: "Campaigns",       icon: Send },
    { id: "sms_marketing",  label: "SMS Marketing",   icon: MessageSquare },
    { id: "lead_vendors",   label: "Lead Vendors",    icon: Globe },
    { id: "email_marketing", label: "Email Marketing", icon: Mail },
    { id: "account_settings", label: "Account Settings", icon: Settings },
    { id: "calls",          label: "Calls",           icon: PhoneCall },
    { id: "sms",            label: "Messages",        icon: MessageSquare },
    { id: "emails",         label: "Emails",          icon: Mail },
    { id: "tasks",          label: "Tasks",           icon: ClipboardList },
    { id: "phone_setup",    label: "Phone Setup",     icon: Phone },
    { id: "billing",        label: "Credits & Billing", icon: CreditCard },
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
        {view === "dashboard" && <DashboardView contacts={contacts} onNav={(v) => setView(v as View)} />}

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
                    <div className="grid grid-cols-[24px_40px_2fr_1fr_1fr_1fr_200px] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground border-b border-border/20">
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
                          className={cn("grid grid-cols-[24px_40px_2fr_1fr_1fr_1fr_200px] gap-3 items-center p-3 rounded-xl border cursor-pointer transition-all",
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
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={async () => {
                              const prompts = (() => { try { return JSON.parse(localStorage.getItem("crm_prompts") || "[]"); } catch { return []; } })();
                              const activeId = localStorage.getItem("active_crm_prompt_id");
                              const prompt = prompts.find((p: any) => p.id === activeId) ?? prompts[0] ?? null;
                              try {
                                await initiateOutboundCall({ to_number: c.phone_number, contact_name: fullName(c), system_prompt: prompt?.content ?? undefined, from_number: prompt?.phoneNumber ?? undefined });
                                toast({ title: `AI calling ${fullName(c)}…` });
                              } catch { toast({ title: "Call failed", variant: "destructive" }); }
                            }} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors whitespace-nowrap">
                              <Phone className="h-3 w-3" /> AI CALL
                            </button>
                            <button onClick={async () => {
                              try {
                                await initiateManualCall({ to_number: c.phone_number, contact_id: c.id, contact_name: fullName(c) });
                                toast({ title: `Calling ${fullName(c)} on your phone…`, description: "Answer your forwarding number to connect." });
                              } catch (err: any) { toast({ title: "Call failed", description: err.message, variant: "destructive" }); }
                            }} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 transition-colors whitespace-nowrap">
                              <Phone className="h-3 w-3" /> CALL
                            </button>
                            <div className="flex gap-1">
                              <button onClick={() => { setEditContact(c); setShowForm(true); }}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-border/40 text-[10px] text-muted-foreground hover:bg-secondary/50 transition-colors">
                                <ChevronDown className="h-3 w-3" /> DISPOSITION
                              </button>
                              <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3 w-3" /></button>
                            </div>
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
            onDelete={handleDelete}
            onStartDialing={(statusId) => { setFilterStatus(statusId); setView("power_dialer"); }} />
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

        {/* AI SMS Inbox */}
        {view === "ai_sms" && <AISMSInboxView />}

        {/* SMS Marketing */}
        {view === "sms_marketing" && <SMSMarketingView />}

        {/* Lead Vendors */}
        {view === "lead_vendors" && <LeadVendorsView />}

        {/* Email Marketing */}
        {view === "email_marketing" && <EmailMarketingView />}

        {/* Account Settings */}
        {view === "account_settings" && <AccountSettingsView />}

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

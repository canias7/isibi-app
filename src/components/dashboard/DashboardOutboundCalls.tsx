import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOutgoing, Plus, X, Phone, Bot, User, FileText,
  CheckCircle2, XCircle, Clock, PhoneCall, Loader2,
  RefreshCw, Ban, ChevronDown, ChevronUp, Info, Search,
  BookUser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  initiateOutboundCall,
  getOutboundCalls,
  cancelOutboundCall,
  listContacts,
  type OutboundCall,
  type AgentOut,
  type Contact,
} from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function contactFullName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

type CallStatus = OutboundCall["status"];

const STATUS_META: Record<CallStatus, { label: string; color: string; icon: React.ElementType; pulse?: boolean }> = {
  queued:        { label: "Queued",      color: "text-muted-foreground", icon: Clock },
  initiated:     { label: "Initiated",   color: "text-amber-500",        icon: PhoneOutgoing, pulse: true },
  ringing:       { label: "Ringing",     color: "text-blue-500",         icon: PhoneCall,     pulse: true },
  "in-progress": { label: "In Progress", color: "text-green-500",        icon: PhoneCall,     pulse: true },
  completed:     { label: "Completed",   color: "text-green-500",        icon: CheckCircle2 },
  failed:        { label: "Failed",      color: "text-destructive",      icon: XCircle },
  busy:          { label: "Busy",        color: "text-destructive",      icon: XCircle },
  "no-answer":   { label: "No Answer",   color: "text-destructive",      icon: XCircle },
  canceled:      { label: "Canceled",    color: "text-muted-foreground", icon: Ban },
};

const ACTIVE_STATUSES: CallStatus[] = ["queued", "initiated", "ringing", "in-progress"];

// ── Contact Picker ────────────────────────────────────────────────────────────

interface ContactPickerProps {
  contacts: Contact[];
  onSelect: (c: Contact) => void;
  onClose: () => void;
}

function ContactPicker({ contacts, onSelect, onClose }: ContactPickerProps) {
  const [q, setQ] = useState("");
  const filtered = contacts.filter((c) => {
    const s = q.toLowerCase();
    return !s || contactFullName(c).toLowerCase().includes(s) || c.phone_number.includes(s) || (c.company ?? "").toLowerCase().includes(s);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-border bg-card shadow-lg overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 px-3">No contacts found</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-bold shrink-0">
                {c.first_name[0]}{c.last_name?.[0] ?? ""}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{contactFullName(c)}</p>
                <p className="text-xs text-muted-foreground">{c.phone_number}{c.company ? ` · ${c.company}` : ""}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface DashboardOutboundCallsProps {
  agents: AgentOut[];
  /** Pre-fill contact from Contacts page */
  prefilledContact?: Contact | null;
}

export default function DashboardOutboundCalls({ agents, prefilledContact }: DashboardOutboundCallsProps) {
  const [calls, setCalls] = useState<OutboundCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!prefilledContact);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // New call form state
  const [agentId, setAgentId] = useState<string>("");
  const [toNumber, setToNumber] = useState(prefilledContact?.phone_number ?? "");
  const [contactName, setContactName] = useState(prefilledContact ? contactFullName(prefilledContact) : "");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(prefilledContact ?? null);
  const [notes, setNotes] = useState("");
  const [initiating, setInitiating] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── fetch ─────────────────────────────────────────────────────────────────────
  const fetchCalls = useCallback(async () => {
    try {
      const data = await getOutboundCalls();
      setCalls(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);
  useEffect(() => { listContacts().then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  // Poll while active calls exist
  useEffect(() => {
    const hasActive = calls.some((c) => ACTIVE_STATUSES.includes(c.status));
    if (!hasActive) return;
    const id = setInterval(fetchCalls, 5000);
    return () => clearInterval(id);
  }, [calls, fetchCalls]);

  // Pre-fill from Contacts page
  useEffect(() => {
    if (prefilledContact) {
      setToNumber(prefilledContact.phone_number);
      setContactName(contactFullName(prefilledContact));
      setSelectedContact(prefilledContact);
      setShowForm(true);
    }
  }, [prefilledContact]);

  // ── contact selection ─────────────────────────────────────────────────────────
  const handleSelectContact = (c: Contact) => {
    setSelectedContact(c);
    setToNumber(c.phone_number);
    setContactName(contactFullName(c));
    setShowPicker(false);
  };

  const clearContact = () => {
    setSelectedContact(null);
    setToNumber("");
    setContactName("");
  };

  // ── initiate call ─────────────────────────────────────────────────────────────
  const handleInitiateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) { toast({ title: "Please select an employee", variant: "destructive" }); return; }
    if (!toNumber.trim()) { toast({ title: "Please enter a phone number", variant: "destructive" }); return; }
    setInitiating(true);
    try {
      const call = await initiateOutboundCall({
        agent_id: Number(agentId),
        to_number: toNumber.trim(),
        contact_name: contactName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Call initiated!", description: `Calling ${contactName || toNumber}…` });
      setCalls((prev) => [call, ...prev]);
      setToNumber(""); setContactName(""); setNotes(""); setSelectedContact(null);
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Failed to initiate call", description: err.message, variant: "destructive" });
    } finally {
      setInitiating(false);
    }
  };

  // ── cancel call ───────────────────────────────────────────────────────────────
  const handleCancel = async (callId: string) => {
    try {
      await cancelOutboundCall(callId);
      toast({ title: "Call canceled" });
      setCalls((prev) => prev.map((c) => (c.id === callId ? { ...c, status: "canceled" as CallStatus } : c)));
    } catch (err: any) {
      toast({ title: "Failed to cancel call", description: err.message, variant: "destructive" });
    }
  };

  const selectedAgent = agents.find((a) => String(a.id) === agentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Outbound Calls</h2>
          <p className="text-sm text-muted-foreground mt-1">Initiate AI-powered outbound calls using your configured employees.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCalls}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showForm ? "Cancel" : "New Call"}
          </Button>
        </div>
      </div>

      {/* New call form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="new-call-form"
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleInitiateCall} className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-xl p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <PhoneOutgoing className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Configure New Call</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Agent */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-muted-foreground" />Employee</Label>
                  {agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">No employees found — create one first.</p>
                  ) : (
                    <select value={agentId} onChange={(e) => setAgentId(e.target.value)} required className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="" disabled>Select an employee…</option>
                      {agents.map((a) => <option key={a.id} value={String(a.id)}>{a.assistant_name}{a.business_name ? ` · ${a.business_name}` : ""}</option>)}
                    </select>
                  )}
                </div>

                {/* Recipient — from contact or manual */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Recipient</Label>
                  {selectedContact ? (
                    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">
                        {selectedContact.first_name[0]}{selectedContact.last_name?.[0] ?? ""}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{contactFullName(selectedContact)}</p>
                        <p className="text-xs text-muted-foreground">{selectedContact.phone_number}</p>
                      </div>
                      <button type="button" onClick={clearContact} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="space-y-2 relative">
                      <div className="flex gap-2">
                        <Input
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={toNumber}
                          onChange={(e) => setToNumber(e.target.value)}
                          required
                          className="bg-background flex-1"
                        />
                        {contacts.length > 0 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker((v) => !v)} title="Pick from contacts">
                            <BookUser className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <AnimatePresence>
                        {showPicker && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1">
                            <ContactPicker contacts={contacts} onSelect={handleSelectContact} onClose={() => setShowPicker(false)} />
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Contact Name (manual) */}
                {!selectedContact && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Contact Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Smith" className="bg-background" />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" />Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Follow up on quote" className="bg-background" />
                </div>
              </div>

              {/* Agent preview */}
              {selectedAgent && (
                <div className="flex items-center gap-3 rounded-xl bg-secondary/40 border border-border/40 px-4 py-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{selectedAgent.assistant_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedAgent.phone_number || "No number assigned"}{selectedAgent.business_name ? ` · ${selectedAgent.business_name}` : ""}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={initiating}>Cancel</Button>
                <Button type="submit" disabled={initiating || agents.length === 0}>
                  {initiating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Initiating…</> : <><PhoneOutgoing className="h-4 w-4 mr-2" />Start Call</>}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-secondary/30 border border-border/30 px-4 py-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
        <p>Outbound calls connect your AI employee to the recipient using the employee's configured system prompt and voice. Calls are billed at your standard per-minute rate.</p>
      </div>

      {/* Call history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Call History</h3>
          {calls.length > 0 && <span className="text-xs text-muted-foreground">{calls.length} call{calls.length !== 1 ? "s" : ""}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-muted-foreground animate-spin" /></div>
        ) : calls.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-12 text-center">
            <PhoneOutgoing className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No outbound calls yet</p>
            <p className="text-sm text-muted-foreground mb-6">Click "New Call" to initiate your first AI-powered outbound call.</p>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />New Call</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {calls.map((call) => {
              const meta = STATUS_META[call.status] ?? STATUS_META.failed;
              const isActive = ACTIVE_STATUSES.includes(call.status);
              const isExpanded = expandedId === call.id;
              return (
                <motion.div key={call.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    {/* Status icon */}
                    <div className={cn("relative flex h-10 w-10 items-center justify-center rounded-xl shrink-0", isActive ? "bg-green-500/10 border border-green-500/20" : "bg-secondary/50 border border-border/40")}>
                      <meta.icon className={cn("h-4 w-4", meta.color)} />
                      {meta.pulse && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{call.contact_name || call.to_number}</p>
                        {call.contact_name && <span className="text-xs text-muted-foreground">{call.to_number}</span>}
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", {
                          "bg-green-500/10 border-green-500/20 text-green-600": call.status === "completed",
                          "bg-green-500/10 border-green-500/20 text-green-500": call.status === "in-progress",
                          "bg-amber-500/10 border-amber-500/20 text-amber-500": call.status === "initiated" || call.status === "ringing",
                          "bg-secondary border-border/40 text-muted-foreground": call.status === "queued" || call.status === "canceled",
                          "bg-destructive/10 border-destructive/20 text-destructive": ["failed", "busy", "no-answer"].includes(call.status),
                        })}>{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {call.agent_name && <span className="flex items-center gap-1"><Bot className="h-3 w-3" />{call.agent_name}</span>}
                        <span>{formatDate(call.created_at)}</span>
                        {call.duration_seconds != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(call.duration_seconds)}</span>}
                        {call.cost != null && <span>${call.cost.toFixed(4)}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleCancel(call.id)}>
                          <Ban className="h-3.5 w-3.5 mr-1" />Cancel
                        </Button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : call.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div key="expanded" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-border/30">
                        <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/10">
                          <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Call ID</p><p className="text-xs font-mono text-foreground truncate">{call.id}</p></div>
                          <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</p><p className="text-sm font-medium text-foreground">{formatDuration(call.duration_seconds)}</p></div>
                          <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cost</p><p className="text-sm font-medium text-foreground">{call.cost != null ? `$${call.cost.toFixed(4)}` : "—"}</p></div>
                          <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p><p className={cn("text-sm font-medium", meta.color)}>{meta.label}</p></div>
                          {call.notes && <div className="col-span-2 sm:col-span-4"><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p><p className="text-sm text-foreground">{call.notes}</p></div>}
                          {call.error_message && <div className="col-span-2 sm:col-span-4"><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Error</p><p className="text-sm text-destructive">{call.error_message}</p></div>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

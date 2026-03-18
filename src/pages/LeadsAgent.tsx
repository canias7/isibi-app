import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, Download, Loader2, Key, Check, X,
  AlertCircle, Mail, Phone, MapPin, Linkedin, Globe, Copy,
  MessageSquare, PhoneCall, FileText, Sparkles, Target, Zap,
  Settings, ExternalLink, ChevronRight, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  getMarketplaceKeys, saveMarketplaceKeys,
  searchApollo, searchNextGen, generateOutreachMessage,
  sendLeadSMS, callLead,
  type MarketplaceKeys, type SearchLead,
} from "@/lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── PDF export ────────────────────────────────────────────────────────────────
function exportPDF(leads: SearchLead[], title: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()} · ${leads.length} leads`, 14, 25);

  autoTable(doc, {
    startY: 30,
    head: [["Name", "Title / Interest", "Company", "Email", "Phone", "Location"]],
    body: leads.map(l => [
      l.name || "",
      l.title || l.interest || "",
      l.company || "",
      l.email || "",
      l.phone || "",
      [l.city, l.state].filter(Boolean).join(", "),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`leads-${Date.now()}.pdf`);
  toast({ title: `✓ PDF downloaded — ${leads.length} leads` });
}

// ── AI Outreach Modal ─────────────────────────────────────────────────────────
function OutreachModal({ lead, onClose }: { lead: SearchLead; onClose: () => void }) {
  const [tab, setTab]         = useState<"sms" | "email" | "call">("sms");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending]       = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await generateOutreachMessage(lead, tab, context);
      if (tab === "email") { setSubject(res.subject || ""); setMessage(res.body || ""); }
      else { setMessage(res.message || ""); }
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleSend = async () => {
    if (tab === "sms") {
      if (!lead.phone) { toast({ title: "No phone number for this lead", variant: "destructive" }); return; }
      if (!message.trim()) { toast({ title: "Write a message first", variant: "destructive" }); return; }
      setSending(true);
      try {
        await sendLeadSMS(lead.phone, message);
        toast({ title: `SMS sent to ${lead.name} ✓` });
        onClose();
      } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
      finally { setSending(false); }
    }
    if (tab === "call") {
      if (!lead.phone) { toast({ title: "No phone number for this lead", variant: "destructive" }); return; }
      setSending(true);
      try {
        await callLead(lead.phone, lead.name);
        toast({ title: `Calling ${lead.name}…` });
        onClose();
      } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
      finally { setSending(false); }
    }
    if (tab === "email") {
      toast({ title: "Email feature coming soon" });
    }
  };

  const TABS = [
    { id: "sms",   label: "SMS",    icon: MessageSquare, color: "text-green-400"  },
    { id: "email", label: "Email",  icon: Mail,          color: "text-blue-400"   },
    { id: "call",  label: "Call",   icon: PhoneCall,     color: "text-purple-400" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/40 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/20">
          <div>
            <p className="text-sm font-semibold">Reach out to {lead.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lead.title || lead.interest || ""}{lead.company ? ` · ${lead.company}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40"><X className="h-4 w-4"/></button>
        </div>

        {/* Channel tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setMessage(""); setSubject(""); }}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all flex-1 justify-center",
                  tab === t.id
                    ? "bg-secondary/40 border-border/50 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className={cn("h-3.5 w-3.5", tab === t.id ? t.color : "")}/>
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Context hint */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">What do you sell? (helps AI personalize)</label>
            <input value={context} onChange={e => setContext(e.target.value)}
              placeholder="e.g. Health insurance, solar panels, real estate…"
              className="w-full h-8 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Email subject */}
          {tab === "email" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Email subject line…"
                className="w-full h-8 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/50"
              />
            </div>
          )}

          {/* Message area */}
          {tab !== "call" ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">{tab === "sms" ? "Message" : "Body"}</label>
                {tab === "sms" && message && (
                  <span className={cn("text-[10px]", message.length > 160 ? "text-red-400" : "text-muted-foreground/60")}>
                    {message.length}/160
                  </span>
                )}
              </div>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder={generating ? "AI is writing…" : "Write your message or click Generate with AI →"}
                rows={tab === "email" ? 6 : 4}
                className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/40"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Call script</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder={generating ? "AI is writing…" : "Generate an AI call script to read when they pick up →"}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/40"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-border/20">
          <Button variant="outline" onClick={generate} disabled={generating} className="flex-1 gap-2 text-xs">
            {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/>Generating…</> : <><Sparkles className="h-3.5 w-3.5"/>Generate with AI</>}
          </Button>
          <Button onClick={handleSend} disabled={sending || (!message.trim() && tab !== "email")} className="flex-1 gap-2 text-xs">
            {sending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/>Sending…</>
              : tab === "sms"   ? <><MessageSquare className="h-3.5 w-3.5"/>Send SMS</>
              : tab === "email" ? <><Mail className="h-3.5 w-3.5"/>Send Email</>
              :                   <><PhoneCall className="h-3.5 w-3.5"/>Start Call</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── API Keys Setup Modal ──────────────────────────────────────────────────────
function KeysModal({ keys, onSaved, onClose }: {
  keys: MarketplaceKeys; onSaved: (k: MarketplaceKeys) => void; onClose: () => void;
}) {
  const [apolloKey,  setApolloKey]  = useState("");
  const [nextgenKey, setNextgenKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body: Record<string, string> = {};
    if (apolloKey.trim())  body.apollo_key  = apolloKey.trim();
    if (nextgenKey.trim()) body.nextgen_key = nextgenKey.trim();
    if (!Object.keys(body).length) { onClose(); return; }
    setSaving(true);
    try {
      await saveMarketplaceKeys(body);
      const updated = await getMarketplaceKeys();
      onSaved(updated);
      toast({ title: "API keys saved ✓" });
      onClose();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/40 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Key className="h-4 w-4 text-primary"/></div>
            <div>
              <p className="text-sm font-semibold">Connect Lead Sources</p>
              <p className="text-xs text-muted-foreground">Your keys — you pay the source directly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40"><X className="h-4 w-4"/></button>
        </div>

        {/* Apollo */}
        <div className="p-4 rounded-xl border border-border/30 bg-secondary/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-orange-400"/></div>
              <div>
                <p className="text-sm font-medium">Apollo.io</p>
                <p className="text-xs text-muted-foreground">B2B — executives, decision makers</p>
              </div>
            </div>
            {keys.apollo.connected
              ? <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20"><Check className="h-3 w-3 mr-1"/>Connected</Badge>
              : <Badge className="text-[10px] text-muted-foreground border-border/30 bg-secondary/50">Not connected</Badge>}
          </div>
          {keys.apollo.connected && <p className="text-[11px] text-muted-foreground font-mono bg-secondary/30 px-3 py-1 rounded">{keys.apollo.masked}</p>}
          <div className="flex items-center gap-2">
            <input value={apolloKey} onChange={e => setApolloKey(e.target.value)} placeholder="Apollo API key…" type="password"
              className="flex-1 h-8 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs font-mono focus:outline-none focus:border-primary/50"/>
            <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-0.5 shrink-0">Get free key <ExternalLink className="h-3 w-3"/></a>
          </div>
        </div>

        {/* NextGen */}
        <div className="p-4 rounded-xl border border-border/30 bg-secondary/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Zap className="h-4 w-4 text-blue-400"/></div>
              <div>
                <p className="text-sm font-medium">NextGen Leads</p>
                <p className="text-xs text-muted-foreground">Consumer — insurance, mortgage, solar</p>
              </div>
            </div>
            {keys.nextgen.connected
              ? <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20"><Check className="h-3 w-3 mr-1"/>Connected</Badge>
              : <Badge className="text-[10px] text-muted-foreground border-border/30 bg-secondary/50">Not connected</Badge>}
          </div>
          {keys.nextgen.connected && <p className="text-[11px] text-muted-foreground font-mono bg-secondary/30 px-3 py-1 rounded">{keys.nextgen.masked}</p>}
          <div className="flex items-center gap-2">
            <input value={nextgenKey} onChange={e => setNextgenKey(e.target.value)} placeholder="NextGen API key…" type="password"
              className="flex-1 h-8 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs font-mono focus:outline-none focus:border-primary/50"/>
            <a href="https://www.nextgenleads.com" target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-0.5 shrink-0">Get key <ExternalLink className="h-3 w-3"/></a>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Saving…</> : "Save →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Lead row inside chat bubble ───────────────────────────────────────────────
function LeadRow({ lead, onOutreach }: { lead: SearchLead; onOutreach: (l: SearchLead) => void }) {
  const [copied, setCopied] = useState(false);
  const copy = (txt: string) => { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/10 hover:bg-secondary/10 transition-colors group last:border-0">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
        {(lead.first_name?.[0] ?? lead.name?.[0] ?? "?").toUpperCase()}
      </div>

      {/* Info grid */}
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{lead.name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.title || lead.interest || "—"}</p>
        </div>
        <div className="min-w-0">
          {lead.company
            ? <p className="text-xs font-medium truncate">{lead.company}</p>
            : lead.age ? <p className="text-xs text-muted-foreground">Age {lead.age}{lead.gender ? ` · ${lead.gender}` : ""}</p> : null}
          {lead.industry && <p className="text-xs text-muted-foreground truncate">{lead.industry}</p>}
        </div>
        <div className="min-w-0 space-y-0.5">
          {lead.email ? (
            <button onClick={() => copy(lead.email!)} className="flex items-center gap-1 text-xs text-primary hover:underline group/e">
              <span className="truncate max-w-[150px]">{lead.email}</span>
              {copied ? <Check className="h-3 w-3 text-green-400 shrink-0"/> : <Copy className="h-3 w-3 opacity-0 group-hover/e:opacity-60 shrink-0"/>}
            </button>
          ) : null}
          {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
          {(lead.city || lead.state) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
              <MapPin className="h-2.5 w-2.5 shrink-0"/>{[lead.city, lead.state].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Source + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge className={cn("text-[10px] border px-2 hidden sm:flex",
          lead.source === "apollo"
            ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
            : "bg-blue-500/10 text-blue-300 border-blue-500/20")}>
          {lead.source === "apollo" ? "Apollo" : "NextGen"}
        </Badge>
        {lead.linkedin_url && (
          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
            <Linkedin className="h-3 w-3"/>
          </a>
        )}
        {/* Outreach button */}
        <button onClick={() => onOutreach(lead)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-xs text-primary font-medium transition-all hover:scale-[1.02] active:scale-[0.98] opacity-0 group-hover:opacity-100">
          <Sparkles className="h-3 w-3"/> Reach out
        </button>
      </div>
    </div>
  );
}

// ── Chat message types ────────────────────────────────────────────────────────
type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; leads: SearchLead[]; source: "apollo" | "nextgen"; prompt: string }
  | { role: "error"; text: string }
  | { role: "thinking"; source: "apollo" | "nextgen" };

const NEXTGEN_VERTICALS = [
  { id: "health_insurance", label: "Health Insurance" },
  { id: "life_insurance",   label: "Life Insurance"   },
  { id: "medicare",         label: "Medicare"         },
  { id: "auto_insurance",   label: "Auto Insurance"   },
  { id: "mortgage",         label: "Mortgage"         },
  { id: "solar",            label: "Solar"            },
  { id: "home_insurance",   label: "Home Insurance"   },
];

const APOLLO_SUGGESTIONS = [
  "Insurance agents in Florida looking to grow their book of business",
  "High income professionals — doctors, lawyers, CFOs in New York",
  "Small business owners in Texas with 10-50 employees",
  "Real estate agents and mortgage brokers in California",
  "CEOs of companies with 50+ employees in the United States",
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadsAgent() {
  const navigate = useNavigate();
  const [keys, setKeys]         = useState<MarketplaceKeys | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [source, setSource]     = useState<"apollo" | "nextgen">("apollo");
  const [outreachLead, setOutreachLead] = useState<SearchLead | null>(null);

  // NextGen filters
  const [ngVertical, setNgVertical] = useState("health_insurance");
  const [ngState,    setNgState]    = useState("");
  const [ngLimit,    setNgLimit]    = useState(25);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { getMarketplaceKeys().then(setKeys).catch(() => {}); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const hasApollo  = keys?.apollo.connected  ?? false;
  const hasNextGen = keys?.nextgen.connected ?? false;

  const runApolloSearch = async (q: string) => {
    setMessages(prev => [...prev, { role: "user", text: q }, { role: "thinking", source: "apollo" }]);
    setBusy(true);
    try {
      const res = await searchApollo(q);
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "assistant", leads: res.leads, source: "apollo", prompt: q },
      ]);
    } catch (e: any) {
      setMessages(prev => [...prev.filter(m => m.role !== "thinking"), { role: "error", text: e.message || "Search failed" }]);
      if (e.message?.toLowerCase().includes("key")) setShowKeys(true);
    } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const runNextGenSearch = async () => {
    const label = NEXTGEN_VERTICALS.find(v => v.id === ngVertical)?.label ?? ngVertical;
    const text = `${label}${ngState ? ` in ${ngState}` : ""} · ${ngLimit} leads`;
    setMessages(prev => [...prev, { role: "user", text }, { role: "thinking", source: "nextgen" }]);
    setBusy(true);
    try {
      const res = await searchNextGen({ vertical: ngVertical, state: ngState, limit: ngLimit });
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "assistant", leads: res.leads, source: "nextgen", prompt: text },
      ]);
    } catch (e: any) {
      setMessages(prev => [...prev.filter(m => m.role !== "thinking"), { role: "error", text: e.message || "Search failed" }]);
    } finally { setBusy(false); }
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q || busy) return;
    if (!hasApollo) { setShowKeys(true); return; }
    setInput("");
    runApolloSearch(q);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <button onClick={() => navigate("/workflow")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4"/> Dashboard
        </button>
        <div className="w-px h-4 bg-border/40"/>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-blue-500/20 border border-orange-500/20 flex items-center justify-center">
            <Target className="h-3.5 w-3.5 text-orange-400"/>
          </div>
          <span className="text-sm font-bold">Leads Agent</span>
        </div>

        {/* Source switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/30 border border-border/30 ml-3">
          {[
            { id: "apollo",  label: "Apollo",   icon: Target, color: "text-orange-400", has: hasApollo  },
            { id: "nextgen", label: "NextGen",   icon: Zap,    color: "text-blue-400",  has: hasNextGen },
          ].map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setSource(s.id as any)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  source === s.id ? "bg-card shadow-sm border border-border/30 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Icon className={cn("h-3 w-3", s.has ? s.color : "text-muted-foreground/40")}/>
                {s.label}
                <span className={cn("w-1.5 h-1.5 rounded-full ml-0.5", s.has ? "bg-green-400" : "bg-muted-foreground/30")}/>
              </button>
            );
          })}
        </div>

        <div className="ml-auto">
          <button onClick={() => setShowKeys(true)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
              (hasApollo || hasNextGen)
                ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/15"
                : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/15 animate-pulse")}>
            <Settings className="h-3.5 w-3.5"/>
            {hasApollo || hasNextGen ? "API Keys" : "Connect Keys"}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-24 px-4 text-center">
            {(!hasApollo && !hasNextGen) ? (
              <div className="max-w-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
                  <Key className="h-7 w-7 text-orange-400"/>
                </div>
                <h2 className="text-lg font-bold">Connect your lead sources</h2>
                <p className="text-sm text-muted-foreground">Add your Apollo.io and/or NextGen Leads API keys to start finding leads instantly.</p>
                <Button onClick={() => setShowKeys(true)} className="gap-2 mx-auto"><Key className="h-4 w-4"/>Connect API Keys →</Button>
              </div>
            ) : source === "apollo" ? (
              <div className="max-w-lg space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-orange-400"/></div>
                    <h2 className="text-lg font-bold">What leads are you looking for?</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">Describe in plain English — AI handles the search</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {APOLLO_SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => { if (!hasApollo) { setShowKeys(true); return; } runApolloSearch(s); }}
                      className="px-3 py-1.5 rounded-full border border-border/40 bg-secondary/20 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition-all text-left">
                      "{s}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-sm space-y-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Zap className="h-4 w-4 text-blue-400"/></div>
                  <h2 className="text-lg font-bold">NextGen Leads</h2>
                </div>
                <p className="text-sm text-muted-foreground">Pick a category below and click Get Leads</p>
              </div>
            )}
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">
          {messages.map((msg, i) => {

            if (msg.role === "user") return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[70%] bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-md px-4 py-2.5">
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            );

            if (msg.role === "thinking") return (
              <div key={i} className="flex">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-md bg-card/40 border border-border/30">
                  <Loader2 className="h-4 w-4 animate-spin text-primary"/>
                  <span className="text-sm text-muted-foreground">
                    {msg.source === "apollo" ? "Searching Apollo.io…" : "Fetching NextGen leads…"}
                  </span>
                </div>
              </div>
            );

            if (msg.role === "error") return (
              <div key={i} className="flex">
                <div className="flex items-start gap-2.5 max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-md bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5"/>
                  <p className="text-sm text-red-300">{msg.text}</p>
                </div>
              </div>
            );

            if (msg.role === "assistant") {
              const withEmail    = msg.leads.filter(l => l.email).length;
              const withPhone    = msg.leads.filter(l => l.phone).length;

              return (
                <div key={i} className="w-full space-y-2">
                  {/* Result header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <Badge className={cn("text-xs border px-2.5 py-1",
                        msg.source === "apollo"
                          ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
                          : "bg-blue-500/10 text-blue-300 border-blue-500/20")}>
                        {msg.source === "apollo" ? "Apollo" : "NextGen"}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {msg.leads.length === 0 ? "No leads found — try different search" : `${msg.leads.length} leads found`}
                      </span>
                      {msg.leads.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          · <span className="text-blue-400">{withEmail} emails</span>
                          · <span className="text-green-400">{withPhone} phones</span>
                        </span>
                      )}
                    </div>
                    {msg.leads.length > 0 && (
                      <Button size="sm" onClick={() => exportPDF(msg.leads, msg.prompt)}
                        className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0">
                        <FileText className="h-3.5 w-3.5"/> Download PDF
                      </Button>
                    )}
                  </div>

                  {/* Leads table */}
                  {msg.leads.length > 0 && (
                    <div className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
                      <div className="hidden sm:grid grid-cols-3 gap-3 px-4 py-2 bg-secondary/20 border-b border-border/20 pr-36">
                        {["Person","Company / Details","Contact & Location"].map(h => (
                          <p key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</p>
                        ))}
                      </div>
                      {msg.leads.map((lead, idx) => (
                        <LeadRow key={idx} lead={lead} onOutreach={setOutreachLead}/>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* ── Input Bar ── */}
      <div className="shrink-0 border-t border-border/30 bg-card/10">
        {source === "apollo" ? (
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={hasApollo ? 'e.g. "Insurance agents in Miami" or "High income doctors in Texas"' : "Connect your Apollo API key to search →"}
              disabled={busy || !hasApollo}
              className="flex-1 h-11 px-4 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 disabled:opacity-50"
            />
            <button onClick={handleSend} disabled={busy || !input.trim() || !hasApollo}
              className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
                input.trim() && !busy && hasApollo
                  ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg hover:scale-105 active:scale-95"
                  : "bg-secondary/30 text-muted-foreground cursor-not-allowed")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
            </button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <select value={ngVertical} onChange={e => setNgVertical(e.target.value)}
              className="h-10 px-3 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none text-foreground">
              {NEXTGEN_VERTICALS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <input value={ngState} onChange={e => setNgState(e.target.value)} placeholder="State (optional)"
              className="h-10 px-3 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50 w-36 placeholder:text-muted-foreground/40"/>
            <select value={ngLimit} onChange={e => setNgLimit(Number(e.target.value))}
              className="h-10 px-3 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} leads</option>)}
            </select>
            <button onClick={runNextGenSearch} disabled={busy || !hasNextGen}
              className={cn("h-10 px-6 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                !busy && hasNextGen
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-secondary/30 text-muted-foreground cursor-not-allowed")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Zap className="h-4 w-4"/>}
              {hasNextGen ? "Get Leads" : "Connect NextGen First"}
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showKeys && keys && <KeysModal keys={keys} onSaved={setKeys} onClose={() => setShowKeys(false)}/>}
      {outreachLead && <OutreachModal lead={outreachLead} onClose={() => setOutreachLead(null)}/>}
    </div>
  );
}

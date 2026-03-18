import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, Download, Loader2, Settings, Key,
  Check, X, AlertCircle, Users, Mail, Phone, MapPin,
  Linkedin, Globe, Copy, Building2, Briefcase, ExternalLink,
  Zap, Target, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  getMarketplaceKeys, saveMarketplaceKeys,
  searchApollo, searchNextGen,
  type MarketplaceKeys, type SearchLead,
} from "@/lib/api";

// ── CSV ───────────────────────────────────────────────────────────────────────
function downloadCSV(leads: SearchLead[], label: string) {
  const cols = ["Source","Name","Title","Company","Email","Phone","City","State","Country","LinkedIn","Industry","Company Size","Website","Age","Gender","Interest"];
  const rows = leads.map(l => [
    l.source, l.name, l.title ?? "", l.company ?? "", l.email ?? "",
    l.phone ?? "", l.city ?? "", l.state ?? "", l.country ?? "",
    l.linkedin_url ?? "", l.industry ?? "",
    l.company_size ? String(l.company_size) : "",
    l.website ?? "", l.age ?? "", l.gender ?? "", l.interest ?? "",
  ]);
  const e = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols, ...rows].map(r => r.map(e).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: `leads-${label}-${Date.now()}.csv`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast({ title: `✓ ${rows.length} leads downloaded` });
}

// ── API Keys Setup Modal ──────────────────────────────────────────────────────
function KeysModal({ keys, onSaved, onClose }: {
  keys: MarketplaceKeys;
  onSaved: (k: MarketplaceKeys) => void;
  onClose: () => void;
}) {
  const [apolloKey,  setApolloKey]  = useState("");
  const [nextgenKey, setNextgenKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body: { apollo_key?: string; nextgen_key?: string } = {};
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
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/40 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Connect Lead Sources</h2>
              <p className="text-xs text-muted-foreground">Add your own API keys — you pay the source directly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40"><X className="h-4 w-4"/></button>
        </div>

        {/* Apollo */}
        <div className="space-y-3 p-4 rounded-xl border border-border/30 bg-secondary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Apollo.io</p>
                <p className="text-xs text-muted-foreground">B2B leads — CEOs, VPs, decision makers</p>
              </div>
            </div>
            {keys.apollo.connected
              ? <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20"><Check className="h-3 w-3 mr-1"/>Connected</Badge>
              : <Badge className="text-[10px] bg-secondary/50 text-muted-foreground border-border/30">Not connected</Badge>
            }
          </div>
          {keys.apollo.connected && (
            <p className="text-xs text-muted-foreground font-mono bg-secondary/30 px-3 py-1.5 rounded-lg">{keys.apollo.masked}</p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{keys.apollo.connected ? "Replace key" : "API Key"}</label>
              <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1">
                Get free key <ExternalLink className="h-2.5 w-2.5"/>
              </a>
            </div>
            <input
              value={apolloKey}
              onChange={e => setApolloKey(e.target.value)}
              placeholder="Paste your Apollo API key…"
              type="password"
              className="w-full h-9 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs font-mono focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* NextGen */}
        <div className="space-y-3 p-4 rounded-xl border border-border/30 bg-secondary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">NextGen Leads</p>
                <p className="text-xs text-muted-foreground">Consumer leads — insurance, mortgage, solar</p>
              </div>
            </div>
            {keys.nextgen.connected
              ? <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20"><Check className="h-3 w-3 mr-1"/>Connected</Badge>
              : <Badge className="text-[10px] bg-secondary/50 text-muted-foreground border-border/30">Not connected</Badge>
            }
          </div>
          {keys.nextgen.connected && (
            <p className="text-xs text-muted-foreground font-mono bg-secondary/30 px-3 py-1.5 rounded-lg">{keys.nextgen.masked}</p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{keys.nextgen.connected ? "Replace key" : "API Key"}</label>
              <a href="https://www.nextgenleads.com" target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1">
                Get key <ExternalLink className="h-2.5 w-2.5"/>
              </a>
            </div>
            <input
              value={nextgenKey}
              onChange={e => setNextgenKey(e.target.value)}
              placeholder="Paste your NextGen Leads API key…"
              type="password"
              className="w-full h-9 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs font-mono focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Saving…</> : "Save Keys →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Lead result card ──────────────────────────────────────────────────────────
function LeadCard({ lead, idx }: { lead: SearchLead; idx: number }) {
  const [copied, setCopied] = useState(false);
  const copyEmail = () => {
    if (!lead.email) return;
    navigator.clipboard.writeText(lead.email);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border/15 hover:bg-secondary/10 transition-colors group">
      <span className="text-xs text-muted-foreground/50 w-5 shrink-0 pt-0.5">{idx + 1}</span>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
        {(lead.first_name?.[0] ?? lead.name?.[0] ?? "?").toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-0.5">
        {/* Name + title */}
        <div>
          <p className="text-sm font-medium truncate">{lead.name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.title || lead.interest || "—"}</p>
        </div>
        {/* Company / consumer info */}
        <div>
          {lead.company ? (
            <>
              <p className="text-xs font-medium truncate">{lead.company}</p>
              {lead.industry && <p className="text-xs text-muted-foreground truncate">{lead.industry}</p>}
            </>
          ) : (
            <>
              {lead.age && <p className="text-xs text-muted-foreground">Age {lead.age}{lead.gender ? ` · ${lead.gender}` : ""}</p>}
            </>
          )}
        </div>
        {/* Contact */}
        <div className="space-y-0.5">
          {lead.email ? (
            <button onClick={copyEmail} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <span className="truncate max-w-[180px]">{lead.email}</span>
              {copied ? <Check className="h-3 w-3 text-green-400 shrink-0"/> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0"/>}
            </button>
          ) : <span className="text-xs text-muted-foreground/50">No email</span>}
          {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
        </div>
        {/* Location + links */}
        <div className="flex items-center justify-between">
          <div>
            {(lead.city || lead.state) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0"/>
                {[lead.city, lead.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {lead.linkedin_url && (
              <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400">
                <Linkedin className="h-3 w-3"/>
              </a>
            )}
            {lead.website && (
              <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1 rounded bg-secondary/40 hover:bg-secondary/60 text-muted-foreground">
                <Globe className="h-3 w-3"/>
              </a>
            )}
          </div>
        </div>
      </div>
      <Badge className={cn("text-[10px] shrink-0 border px-2",
        lead.source === "apollo"
          ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
          : "bg-blue-500/10 text-blue-300 border-blue-500/20"
      )}>
        {lead.source === "apollo" ? "Apollo" : "NextGen"}
      </Badge>
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
  { id: "health_insurance",  label: "Health Insurance"  },
  { id: "life_insurance",    label: "Life Insurance"    },
  { id: "medicare",          label: "Medicare"          },
  { id: "auto_insurance",    label: "Auto Insurance"    },
  { id: "mortgage",          label: "Mortgage"          },
  { id: "solar",             label: "Solar"             },
  { id: "home_insurance",    label: "Home Insurance"    },
];

const APOLLO_SUGGESTIONS = [
  "Insurance agents and brokers in Florida",
  "High income executives — doctors, lawyers, CFOs in New York",
  "Small business owners in Texas with 10-50 employees",
  "Real estate agents and mortgage brokers in California",
  "CEOs of companies with $1M+ revenue in the United States",
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

  // NextGen specific filters
  const [ngVertical, setNgVertical] = useState("health_insurance");
  const [ngState,    setNgState]    = useState("");
  const [ngLimit,    setNgLimit]    = useState(25);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMarketplaceKeys().then(setKeys).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasApollo  = keys?.apollo.connected  ?? false;
  const hasNextGen = keys?.nextgen.connected ?? false;
  const canSearch  = source === "apollo" ? hasApollo : hasNextGen;

  const searchApolloHandler = async (q: string) => {
    setMessages(prev => [...prev, { role: "user", text: q }, { role: "thinking", source: "apollo" }]);
    setBusy(true);
    try {
      const res = await searchApollo(q);
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "assistant", leads: res.leads, source: "apollo", prompt: q },
      ]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "error", text: e.message || "Apollo search failed" },
      ]);
      if (e.message?.includes("key")) setShowKeys(true);
    } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const searchNextGenHandler = async () => {
    const label = `${NEXTGEN_VERTICALS.find(v => v.id === ngVertical)?.label ?? ngVertical}${ngState ? ` in ${ngState}` : ""}`;
    setMessages(prev => [...prev, { role: "user", text: label }, { role: "thinking", source: "nextgen" }]);
    setBusy(true);
    try {
      const res = await searchNextGen({ vertical: ngVertical, state: ngState, limit: ngLimit });
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "assistant", leads: res.leads, source: "nextgen", prompt: label },
      ]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "error", text: e.message || "NextGen search failed" },
      ]);
      if (e.message?.includes("key")) setShowKeys(true);
    } finally { setBusy(false); }
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q || busy) return;
    if (!canSearch) { setShowKeys(true); return; }
    setInput("");
    searchApolloHandler(q);
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
            <Users className="h-3.5 w-3.5 text-orange-400"/>
          </div>
          <span className="text-sm font-bold">Leads Agent</span>
        </div>

        {/* Source toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/30 border border-border/30 ml-4">
          {[
            { id: "apollo",  label: "Apollo",  icon: Target, color: "text-orange-400" },
            { id: "nextgen", label: "NextGen",  icon: Zap,    color: "text-blue-400"  },
          ].map(s => {
            const Icon = s.icon;
            const connected = s.id === "apollo" ? hasApollo : hasNextGen;
            return (
              <button key={s.id}
                onClick={() => setSource(s.id as "apollo" | "nextgen")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  source === s.id
                    ? "bg-card shadow-sm border border-border/30 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <Icon className={cn("h-3 w-3", connected ? s.color : "text-muted-foreground/50")}/>
                {s.label}
                {connected
                  ? <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5"/>
                  : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 ml-0.5"/>
                }
              </button>
            );
          })}
        </div>

        <div className="ml-auto">
          <button onClick={() => setShowKeys(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
              (hasApollo || hasNextGen)
                ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/15"
                : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/15 animate-pulse"
            )}>
            <Settings className="h-3.5 w-3.5"/>
            {hasApollo || hasNextGen ? "API Keys" : "Connect Keys"}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-24 px-4 text-center">
            {(!hasApollo && !hasNextGen) ? (
              <div className="max-w-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
                  <Key className="h-7 w-7 text-orange-400"/>
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold">Connect your lead sources</h2>
                  <p className="text-sm text-muted-foreground">Add your Apollo.io and/or NextGen Leads API keys to start finding leads.</p>
                </div>
                <Button onClick={() => setShowKeys(true)} className="gap-2">
                  <Key className="h-4 w-4"/> Connect API Keys →
                </Button>
              </div>
            ) : source === "apollo" ? (
              <div className="max-w-lg space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Target className="h-4 w-4 text-orange-400"/>
                    </div>
                    <h2 className="text-lg font-bold">Apollo Search</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">Describe who you're looking for in plain English</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {APOLLO_SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => { if (!canSearch) { setShowKeys(true); return; } searchApolloHandler(s); }}
                      className="px-3 py-1.5 rounded-full border border-border/40 bg-secondary/20 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition-all">
                      "{s}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-sm space-y-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-blue-400"/>
                  </div>
                  <h2 className="text-lg font-bold">NextGen Leads</h2>
                </div>
                <p className="text-sm text-muted-foreground">Select a lead vertical and click Search</p>
              </div>
            )}
          </div>
        )}

        {/* Message list */}
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
              <div key={i} className="flex justify-start">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-md bg-card/40 border border-border/30">
                  <Loader2 className="h-4 w-4 animate-spin text-primary"/>
                  <span className="text-sm text-muted-foreground">
                    {msg.source === "apollo" ? "Searching Apollo.io…" : "Fetching NextGen leads…"}
                  </span>
                </div>
              </div>
            );

            if (msg.role === "error") return (
              <div key={i} className="flex justify-start">
                <div className="flex items-start gap-2.5 max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-md bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5"/>
                  <p className="text-sm text-red-300">{msg.text}</p>
                </div>
              </div>
            );

            if (msg.role === "assistant") {
              const withEmail    = msg.leads.filter(l => l.email).length;
              const withPhone    = msg.leads.filter(l => l.phone).length;
              const withLinkedIn = msg.leads.filter(l => l.linkedin_url).length;

              return (
                <div key={i} className="flex justify-start w-full">
                  <div className="w-full space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <Badge className={cn("text-xs border px-2.5 py-1",
                          msg.source === "apollo"
                            ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
                            : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                        )}>
                          {msg.source === "apollo" ? "Apollo" : "NextGen"}
                        </Badge>
                        <span className="text-sm font-semibold">
                          {msg.leads.length === 0 ? "No leads found" : `${msg.leads.length} leads found`}
                        </span>
                      </div>
                      {msg.leads.length > 0 && (
                        <Button size="sm" onClick={() => downloadCSV(msg.leads, msg.source)}
                          className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                          <Download className="h-3.5 w-3.5"/> Download CSV
                        </Button>
                      )}
                    </div>

                    {/* Stats */}
                    {msg.leads.length > 0 && (
                      <div className="flex gap-4 text-xs">
                        <span className="text-blue-400"><strong>{withEmail}</strong> <span className="text-muted-foreground">with email</span></span>
                        <span className="text-green-400"><strong>{withPhone}</strong> <span className="text-muted-foreground">with phone</span></span>
                        {withLinkedIn > 0 && <span className="text-sky-400"><strong>{withLinkedIn}</strong> <span className="text-muted-foreground">with LinkedIn</span></span>}
                      </div>
                    )}

                    {/* Table */}
                    {msg.leads.length > 0 && (
                      <div className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
                        <div className="grid grid-cols-4 gap-x-4 px-4 py-2 bg-secondary/20 border-b border-border/20">
                          {["Person","Company / Info","Contact","Location"].map(h => (
                            <p key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</p>
                          ))}
                        </div>
                        {msg.leads.map((lead, idx) => (
                          <LeadCard key={idx} lead={lead} idx={idx}/>
                        ))}
                      </div>
                    )}
                  </div>
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
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={hasApollo ? 'e.g. "High income doctors and lawyers in Miami"' : "Connect your Apollo API key first →"}
              disabled={busy || !hasApollo}
              className="flex-1 h-11 px-4 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 disabled:opacity-50"
            />
            <button onClick={handleSend} disabled={busy || !input.trim() || !hasApollo}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
                input.trim() && !busy && hasApollo
                  ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg hover:scale-105 active:scale-95"
                  : "bg-secondary/30 text-muted-foreground cursor-not-allowed"
              )}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
            </button>
          </div>
        ) : (
          /* NextGen filter bar */
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <select value={ngVertical} onChange={e => setNgVertical(e.target.value)}
              className="h-10 px-3 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50 text-foreground">
              {NEXTGEN_VERTICALS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <input value={ngState} onChange={e => setNgState(e.target.value)}
              placeholder="State (e.g. Florida)"
              className="h-10 px-3 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50 w-40 placeholder:text-muted-foreground/40"
            />
            <select value={ngLimit} onChange={e => setNgLimit(Number(e.target.value))}
              className="h-10 px-3 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} leads</option>)}
            </select>
            <button onClick={searchNextGenHandler} disabled={busy || !hasNextGen}
              className={cn(
                "h-10 px-5 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                !busy && hasNextGen
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-secondary/30 text-muted-foreground cursor-not-allowed"
              )}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Zap className="h-4 w-4"/>}
              {hasNextGen ? "Get Leads" : "Connect NextGen Key First"}
            </button>
          </div>
        )}
      </div>

      {/* ── Keys Modal ── */}
      {showKeys && keys && (
        <KeysModal keys={keys} onSaved={setKeys} onClose={() => setShowKeys(false)}/>
      )}
      {showKeys && !keys && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <Loader2 className="h-8 w-8 animate-spin text-primary"/>
        </div>
      )}
    </div>
  );
}

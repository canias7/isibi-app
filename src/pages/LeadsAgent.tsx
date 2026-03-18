import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Download, Sparkles, History, ChevronLeft, ChevronRight,
  Settings, Key, ExternalLink, Loader2, Users, Target, Building2,
  Mail, Phone, MapPin, Linkedin, Globe, X, Check, AlertCircle,
  ArrowLeft, RefreshCw, Copy, Zap, TrendingUp, Briefcase,
  HeartHandshake, Stethoscope, ShoppingBag, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  getLeadsSettings, saveLeadsSettings,
  getLeadsHistory, getLeadsSearchResults, searchLeads,
  type Lead, type LeadSearch, type LeadSearchResult,
} from "@/lib/api";
import { FadeIn, SlideIn, StaggerChildren, StaggerItem } from "@/components/ui/motion";

// ── Vibe presets ──────────────────────────────────────────────────────────────

const VIBES = [
  {
    emoji: "🎯",
    icon: Target,
    title: "Decision Makers",
    subtitle: "VPs & Directors",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    iconColor: "text-blue-400",
    prompt: "Find 25 VPs and Directors of Sales at B2B SaaS companies with 50-500 employees in the United States",
  },
  {
    emoji: "🚀",
    icon: Zap,
    title: "Startup Founders",
    subtitle: "Seed & Series A",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    iconColor: "text-purple-400",
    prompt: "Find 30 founders and co-founders of tech startups with 1-20 employees in the United States",
  },
  {
    emoji: "💰",
    icon: TrendingUp,
    title: "Enterprise Buyers",
    subtitle: "500+ employees",
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    iconColor: "text-emerald-400",
    prompt: "Find 25 CTOs and CIOs at enterprise companies with 500 or more employees in the United States",
  },
  {
    emoji: "🏢",
    icon: Briefcase,
    title: "Agency Owners",
    subtitle: "Marketing & Digital",
    color: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    iconColor: "text-orange-400",
    prompt: "Find 25 owners and founders of digital marketing agencies with 5-50 employees in the United States",
  },
  {
    emoji: "🤝",
    icon: HeartHandshake,
    title: "Local Business",
    subtitle: "Small biz owners",
    color: "from-pink-500/20 to-pink-600/10 border-pink-500/30",
    iconColor: "text-pink-400",
    prompt: "Find 30 owners and managers of local small businesses in Miami, Florida",
  },
  {
    emoji: "🏥",
    icon: Stethoscope,
    title: "Healthcare",
    subtitle: "Clinics & practices",
    color: "from-teal-500/20 to-teal-600/10 border-teal-500/30",
    iconColor: "text-teal-400",
    prompt: "Find 25 practice managers and medical directors at private healthcare clinics in the United States",
  },
  {
    emoji: "🏠",
    icon: Home,
    title: "Real Estate",
    subtitle: "Agents & brokers",
    color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30",
    iconColor: "text-yellow-400",
    prompt: "Find 30 real estate agents, brokers, and team leaders at real estate companies in Florida",
  },
  {
    emoji: "🛍️",
    icon: ShoppingBag,
    title: "E-commerce",
    subtitle: "DTC brands",
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
    iconColor: "text-rose-400",
    prompt: "Find 25 founders and CEOs of direct-to-consumer ecommerce brands with 5-100 employees",
  },
];

// ── CSV Download ──────────────────────────────────────────────────────────────

function downloadLeadsCSV(leads: Lead[], prompt: string) {
  const headers = ["Name", "Title", "Company", "Email", "Phone", "City", "State", "Country", "LinkedIn", "Industry", "Company Size", "Website"];
  const rows = leads.map(l => [
    l.name, l.title ?? "", l.company ?? "", l.email ?? "",
    l.phone ?? "", l.city ?? "", l.state ?? "", l.country ?? "",
    l.linkedin_url ?? "", l.industry ?? "",
    l.company_size ? String(l.company_size) : "", l.website ?? "",
  ]);
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast({ title: `${leads.length} leads downloaded ✓` });
}

// ── API Key Setup Modal ───────────────────────────────────────────────────────

function ApiKeyModal({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!key.trim()) { toast({ title: "Enter your API key", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await saveLeadsSettings(key.trim());
      toast({ title: "Apollo.io connected ✓" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <FadeIn>
        <div className="bg-card border border-border/30 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Connect Apollo.io</h2>
                <p className="text-xs text-muted-foreground">Required to search for leads</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40"><X className="h-4 w-4" /></button>
          </div>

          <div className="rounded-xl bg-secondary/20 border border-border/20 p-4 space-y-2">
            <p className="text-xs font-medium">How to get your API key:</p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Go to <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">apollo.io/settings/api <ExternalLink className="h-3 w-3" /></a></li>
              <li>Click <strong className="text-foreground">Create new key</strong></li>
              <li>Copy and paste it below</li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Apollo.io API Key</Label>
            <Input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-••••••••••••••••••••••"
              type="password"
              className="h-9 text-sm font-mono"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : "Connect Apollo →"}
            </Button>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

// ── Lead Row ──────────────────────────────────────────────────────────────────

function LeadRow({ lead, idx }: { lead: Lead; idx: number }) {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    if (!lead.email) return;
    navigator.clipboard.writeText(lead.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors group">
      <td className="px-4 py-3 text-xs text-muted-foreground w-8">{idx + 1}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">
              {(lead.first_name?.[0] ?? lead.name?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{lead.name || "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{lead.title || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium">{lead.company || "—"}</p>
          {lead.industry && <p className="text-xs text-muted-foreground">{lead.industry}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        {lead.email ? (
          <button onClick={copyEmail} className="flex items-center gap-1.5 group/email">
            <span className="text-xs text-primary hover:underline">{lead.email}</span>
            {copied
              ? <Check className="h-3 w-3 text-green-400" />
              : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/email:opacity-100 transition-opacity" />
            }
          </button>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not available</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">{lead.phone || "—"}</span>
      </td>
      <td className="px-4 py-3">
        {(lead.city || lead.state) ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {[lead.city, lead.state].filter(Boolean).join(", ")}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {lead.linkedin_url && (
            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
              <Linkedin className="h-3.5 w-3.5" />
            </a>
          )}
          {lead.website && (
            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/60 text-muted-foreground transition-colors">
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsAgent() {
  const navigate = useNavigate();
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Settings
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Search
  const [prompt, setPrompt] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<LeadSearchResult | null>(null);
  const [error, setError] = useState("");

  // History
  const [history, setHistory] = useState<LeadSearch[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load settings + history on mount
  useEffect(() => {
    getLeadsSettings()
      .then(s => { setHasKey(s.has_key); setMaskedKey(s.masked_key); setSettingsLoaded(true); })
      .catch(() => setSettingsLoaded(true));
    refreshHistory();
  }, []);

  const refreshHistory = () => {
    setLoadingHistory(true);
    getLeadsHistory()
      .then(h => setHistory(h))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  const handleSearch = async () => {
    const q = prompt.trim();
    if (!q) { toast({ title: "Describe the leads you want to find", variant: "destructive" }); return; }
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const r = await searchLeads(q);
      setResult(r);
      refreshHistory();
      if (r.total === 0) {
        toast({ title: "No leads found", description: "Try a broader search or different filters." });
      } else {
        toast({ title: `Found ${r.total} leads ✓` });
      }
    } catch (e: any) {
      const msg = e.message || "Search failed";
      setError(msg);
      if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("apollo")) {
        setShowKeyModal(true);
      }
    } finally { setSearching(false); }
  };

  const loadHistoryResult = async (item: LeadSearch) => {
    try {
      const r = await getLeadsSearchResults(item.id);
      setResult({ leads: r.leads, total: r.leads.length, prompt: item.prompt });
      setPrompt(item.prompt);
    } catch {
      toast({ title: "Could not load results", variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch();
  };

  const onVibeClick = (vibePrompt: string) => {
    setPrompt(vibePrompt);
    promptRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-4 px-6 py-3.5 border-b border-border/30 bg-card/20 shrink-0">
        <button onClick={() => navigate("/workflow")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>
        <div className="w-px h-4 bg-border/40" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/20 flex items-center justify-center">
            <Target className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">Leads Agent</h1>
            <p className="text-[10px] text-muted-foreground">AI-powered prospecting</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {settingsLoaded && (
            hasKey ? (
              <button onClick={() => setShowKeyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 hover:bg-green-500/15 transition-colors">
                <Check className="h-3.5 w-3.5" />
                Apollo Connected
              </button>
            ) : (
              <button onClick={() => setShowKeyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 hover:bg-orange-500/15 transition-colors animate-pulse">
                <AlertCircle className="h-3.5 w-3.5" />
                Connect Apollo.io
              </button>
            )
          )}
          <button onClick={() => setSidebarOpen(p => !p)}
            className="p-2 rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground">
            <History className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar: Search History ── */}
        <div className={cn(
          "border-r border-border/30 bg-card/10 flex flex-col transition-all duration-300 shrink-0",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}>
          <div className="p-4 border-b border-border/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search History</p>
              <button onClick={refreshHistory} className="p-1 rounded hover:bg-secondary/40 transition-colors">
                <RefreshCw className={cn("h-3 w-3 text-muted-foreground", loadingHistory && "animate-spin")} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {history.length === 0 ? (
              <div className="px-2 py-8 text-center">
                <History className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No searches yet</p>
              </div>
            ) : (
              history.map(item => (
                <button key={item.id} onClick={() => loadHistoryResult(item)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-colors group">
                  <p className="text-xs font-medium line-clamp-2 group-hover:text-foreground text-muted-foreground leading-snug">{item.prompt}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-primary">{item.results_count} leads</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

            {/* No API key banner */}
            {settingsLoaded && !hasKey && (
              <SlideIn direction="down">
                <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 flex items-center gap-4">
                  <AlertCircle className="h-5 w-5 text-orange-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-300">Apollo.io not connected</p>
                    <p className="text-xs text-orange-300/70 mt-0.5">Connect your free Apollo.io API key to start finding leads.</p>
                  </div>
                  <Button size="sm" onClick={() => setShowKeyModal(true)}
                    className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 shrink-0">
                    Connect Now →
                  </Button>
                </div>
              </SlideIn>
            )}

            {/* ── Hero prompt area ── */}
            <FadeIn>
              <div className="space-y-3">
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
                    Who are you looking for?
                  </h2>
                  <p className="text-sm text-muted-foreground">Describe your ideal lead in plain English — AI handles the rest</p>
                </div>

                <div className="relative">
                  <Textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={'e.g. "Find me 30 SaaS CEOs in Miami with 10-50 employees who are actively hiring"'}
                    className="min-h-[100px] text-sm resize-none pr-28 rounded-2xl border-border/40 bg-card/40 focus:border-primary/40 placeholder:text-muted-foreground/40"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searching || !prompt.trim()}
                    className="absolute bottom-3 right-3 gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white border-0 shadow-lg shadow-orange-500/20"
                  >
                    {searching
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Searching…</>
                      : <><Search className="h-4 w-4" />Find Leads</>
                    }
                  </Button>
                </div>
                <p className="text-[11px] text-center text-muted-foreground/50">
                  Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[10px] font-mono">⌘ Enter</kbd> to search
                </p>
              </div>
            </FadeIn>

            {/* ── Vibe cards ── */}
            {!result && !searching && (
              <FadeIn delay={0.1}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Vibe Prospecting</p>
                    <p className="text-xs text-muted-foreground">— pick a target, we'll find the leads</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {VIBES.map(v => (
                      <button key={v.title} onClick={() => onVibeClick(v.prompt)}
                        className={cn(
                          "p-3.5 rounded-2xl border bg-gradient-to-br text-left hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 group",
                          v.color
                        )}>
                        <div className="text-xl mb-2">{v.emoji}</div>
                        <p className="text-sm font-semibold leading-tight">{v.title}</p>
                        <p className={cn("text-[11px] mt-0.5", v.iconColor)}>{v.subtitle}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* ── Searching animation ── */}
            {searching && (
              <FadeIn>
                <div className="rounded-2xl border border-border/30 bg-card/20 p-10 text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="h-7 w-7 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">AI is analyzing your request…</p>
                    <p className="text-xs text-muted-foreground">Extracting filters → querying Apollo.io → sorting results</p>
                  </div>
                  <div className="flex justify-center gap-1.5">
                    {["Parsing prompt", "Building filters", "Fetching leads"].map((s, i) => (
                      <span key={s} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary"
                        style={{ animationDelay: `${i * 0.4}s` }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* ── Error state ── */}
            {error && !searching && (
              <SlideIn direction="up">
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Search failed</p>
                    <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
                  </div>
                  <button onClick={() => setError("")} className="ml-auto p-1 hover:bg-red-500/20 rounded-lg transition-colors">
                    <X className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </SlideIn>
            )}

            {/* ── Results ── */}
            {result && !searching && (
              <FadeIn>
                <div className="space-y-4">
                  {/* Results header */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {result.total} lead{result.total !== 1 ? "s" : ""} found
                        </p>
                        {result.prompt && (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-sm">"{result.prompt}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setResult(null); setPrompt(""); setError(""); }}
                        className="gap-2 text-xs h-8">
                        <RefreshCw className="h-3.5 w-3.5" />
                        New Search
                      </Button>
                      {result.leads.length > 0 && (
                        <Button size="sm" onClick={() => downloadLeadsCSV(result.leads, result.prompt ?? "")}
                          className="gap-2 text-xs h-8 bg-green-600 hover:bg-green-700 text-white border-0">
                          <Download className="h-3.5 w-3.5" />
                          Download CSV ({result.total})
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  {result.leads.length > 0 && (() => {
                    const withEmail = result.leads.filter(l => l.email).length;
                    const withPhone = result.leads.filter(l => l.phone).length;
                    const withLinkedIn = result.leads.filter(l => l.linkedin_url).length;
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "With Email", value: withEmail, icon: Mail, color: "text-blue-400 bg-blue-500/10" },
                          { label: "With Phone", value: withPhone, icon: Phone, color: "text-green-400 bg-green-500/10" },
                          { label: "With LinkedIn", value: withLinkedIn, icon: Linkedin, color: "text-sky-400 bg-sky-500/10" },
                        ].map(s => (
                          <div key={s.label} className="rounded-xl border border-border/30 bg-card/30 p-3 flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.color)}>
                              <s.icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-base font-bold leading-none">{s.value}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Table */}
                  {result.leads.length > 0 ? (
                    <div className="rounded-2xl border border-border/30 bg-card/20 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30 bg-secondary/20">
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-8">#</th>
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Person</th>
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Phone</th>
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Location</th>
                              <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Links</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.leads.map((lead, i) => (
                              <LeadRow key={i} lead={lead} idx={i} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/30 bg-card/20 p-10 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No leads matched your search</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try broadening your criteria or using a different location</p>
                    </div>
                  )}

                  {/* Download CTA at bottom */}
                  {result.leads.length > 0 && (
                    <div className="flex justify-center pt-2">
                      <Button onClick={() => downloadLeadsCSV(result.leads, result.prompt ?? "")}
                        className="gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white border-0 shadow-lg shadow-orange-500/20 px-8">
                        <Download className="h-4 w-4" />
                        Download {result.total} Leads as CSV
                      </Button>
                    </div>
                  )}
                </div>
              </FadeIn>
            )}

          </div>
        </div>
      </div>

      {/* ── API Key Modal ── */}
      {showKeyModal && (
        <ApiKeyModal
          onSaved={() => {
            setHasKey(true);
            setShowKeyModal(false);
            getLeadsSettings().then(s => setMaskedKey(s.masked_key));
          }}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}

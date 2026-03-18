import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, Download, Target, Loader2,
  Mail, Phone, Linkedin, MapPin, Globe, Copy, Check,
  AlertCircle, Key, ExternalLink, X, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  getLeadsSettings, saveLeadsSettings, searchLeads,
  type Lead, type LeadSearchResult,
} from "@/lib/api";

// ── CSV download ──────────────────────────────────────────────────────────────
function downloadCSV(leads: Lead[]) {
  const headers = ["Name","Title","Company","Email","Phone","City","State","Country","LinkedIn","Industry","Company Size","Website"];
  const rows = leads.map(l => [
    l.name, l.title ?? "", l.company ?? "", l.email ?? "",
    l.phone ?? "", l.city ?? "", l.state ?? "", l.country ?? "",
    l.linkedin_url ?? "", l.industry ?? "",
    l.company_size ? String(l.company_size) : "", l.website ?? "",
  ]);
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: `leads-${Date.now()}.csv`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast({ title: `✓ ${leads.length} leads downloaded` });
}

// ── API Key Modal ─────────────────────────────────────────────────────────────
function ApiKeyModal({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await saveLeadsSettings(key.trim());
      toast({ title: "Apollo.io connected ✓" });
      onSaved();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/30 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Key className="h-4.5 w-4.5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Connect Apollo.io</p>
              <p className="text-xs text-muted-foreground">Paste your free API key below</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl bg-secondary/20 border border-border/20 p-4 space-y-1.5">
          <p className="text-xs font-medium">Where to find your key:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">apollo.io → Settings → API <ExternalLink className="h-3 w-3" /></a></li>
            <li>Click <strong className="text-foreground">Create new key</strong></li>
            <li>Copy & paste it below — it's free</li>
          </ol>
        </div>

        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()}
          placeholder="sk-••••••••••••••••••••••"
          type="password"
          className="w-full h-9 px-3 rounded-lg bg-secondary/30 border border-border/40 text-sm font-mono focus:outline-none focus:border-primary/50"
        />

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || !key.trim()} className="flex-1">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Connect →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Lead Table (shown inside chat bubble) ─────────────────────────────────────
function LeadTable({ leads }: { leads: Lead[] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyEmail = (email: string, i: number) => {
    navigator.clipboard.writeText(email);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/30 bg-background/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20 bg-secondary/20">
            {["#","Name / Title","Company","Email","Phone","Location","Links"].map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((l, i) => (
            <tr key={i} className="border-b border-border/10 hover:bg-secondary/10 transition-colors">
              <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">
                      {(l.first_name?.[0] ?? l.name?.[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium leading-none">{l.name || "—"}</p>
                    <p className="text-muted-foreground mt-0.5">{l.title || "—"}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <p className="font-medium">{l.company || "—"}</p>
                {l.industry && <p className="text-muted-foreground">{l.industry}</p>}
              </td>
              <td className="px-3 py-2.5">
                {l.email ? (
                  <button onClick={() => copyEmail(l.email!, i)} className="flex items-center gap-1 group">
                    <span className="text-primary hover:underline">{l.email}</span>
                    {copiedIdx === i
                      ? <Check className="h-3 w-3 text-green-400" />
                      : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    }
                  </button>
                ) : <span className="text-muted-foreground italic">—</span>}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{l.phone || "—"}</td>
              <td className="px-3 py-2.5">
                {(l.city || l.state) ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[l.city, l.state].filter(Boolean).join(", ")}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  {l.linkedin_url && (
                    <a href={l.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
                      <Linkedin className="h-3 w-3" />
                    </a>
                  )}
                  {l.website && (
                    <a href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded-md bg-secondary/40 hover:bg-secondary/60 text-muted-foreground transition-colors">
                      <Globe className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Chat message types ────────────────────────────────────────────────────────
type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; result: LeadSearchResult }
  | { role: "error"; text: string }
  | { role: "thinking" };

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadsAgent() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLeadsSettings()
      .then(s => setHasKey(s.has_key))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }, { role: "thinking" }]);
    setBusy(true);
    try {
      const result = await searchLeads(q);
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "assistant", result },
      ]);
    } catch (e: any) {
      const msg = e.message || "Search failed";
      setMessages(prev => [
        ...prev.filter(m => m.role !== "thinking"),
        { role: "error", text: msg },
      ]);
      if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("apollo") || msg.toLowerCase().includes("connect")) {
        setShowKeyModal(true);
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-card/20 shrink-0">
        <button onClick={() => navigate("/workflow")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>
        <div className="w-px h-4 bg-border/40" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/20 flex items-center justify-center">
            <Target className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <span className="text-sm font-bold">Leads Agent</span>
        </div>
        <div className="ml-auto">
          {hasKey ? (
            <button onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 hover:bg-green-500/15 transition-colors">
              <Check className="h-3 w-3" /> Apollo Connected
            </button>
          ) : (
            <button onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 hover:bg-orange-500/15 transition-colors animate-pulse">
              <AlertCircle className="h-3 w-3" /> Connect Apollo.io
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-20">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/20 flex items-center justify-center">
              <Target className="h-8 w-8 text-orange-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Find your next leads</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Describe who you're looking for in plain English — industry, title, location, company size — and I'll pull the list.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {[
                "30 SaaS CEOs in Miami with 10-50 employees",
                "Founders of DTC ecommerce brands in the US",
                "VPs of Sales at B2B companies, 100-500 employees",
                "Real estate brokers in Florida",
              ].map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className="px-3 py-1.5 rounded-full border border-border/40 bg-secondary/20 text-xs text-muted-foreground hover:text-foreground hover:border-border/70 transition-all">
                  "{s}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
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
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Searching Apollo.io…</span>
              </div>
            </div>
          );

          if (msg.role === "error") return (
            <div key={i} className="flex justify-start">
              <div className="flex items-start gap-2.5 max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-md bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{msg.text}</p>
              </div>
            </div>
          );

          if (msg.role === "assistant") {
            const { result } = msg;
            const withEmail = result.leads.filter(l => l.email).length;
            const withPhone = result.leads.filter(l => l.phone).length;
            const withLinkedIn = result.leads.filter(l => l.linkedin_url).length;

            return (
              <div key={i} className="flex justify-start">
                <div className="w-full max-w-5xl space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">
                        Found {result.total} lead{result.total !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {result.leads.length > 0 && (
                      <Button size="sm" onClick={() => downloadCSV(result.leads)}
                        className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                        <Download className="h-3.5 w-3.5" />
                        Download CSV
                      </Button>
                    )}
                  </div>

                  {/* Stats */}
                  {result.leads.length > 0 && (
                    <div className="flex gap-3">
                      {[
                        { label: "with email", value: withEmail, color: "text-blue-400" },
                        { label: "with phone", value: withPhone, color: "text-green-400" },
                        { label: "with LinkedIn", value: withLinkedIn, color: "text-sky-400" },
                      ].map(s => (
                        <span key={s.label} className={cn("text-xs", s.color)}>
                          <strong>{s.value}</strong> <span className="text-muted-foreground">{s.label}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Table or empty */}
                  {result.leads.length > 0
                    ? <LeadTable leads={result.leads} />
                    : (
                      <div className="rounded-xl border border-border/30 bg-card/20 p-8 text-center">
                        <p className="text-sm text-muted-foreground">No leads matched — try broader criteria.</p>
                      </div>
                    )
                  }
                </div>
              </div>
            );
          }

          return null;
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Input Bar ── */}
      <div className="shrink-0 px-4 py-4 border-t border-border/30 bg-card/10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder='e.g. "50 real estate agents in Texas"'
            disabled={busy}
            className="flex-1 h-11 px-4 rounded-xl bg-secondary/30 border border-border/40 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 disabled:opacity-50"
          />
          <button onClick={send} disabled={busy || !input.trim()}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
              input.trim() && !busy
                ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95"
                : "bg-secondary/30 text-muted-foreground cursor-not-allowed"
            )}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── API Key Modal ── */}
      {showKeyModal && (
        <ApiKeyModal
          onSaved={() => { setHasKey(true); setShowKeyModal(false); }}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}

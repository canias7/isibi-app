import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Target, Coins, Download, Lock, Unlock, Mail, Phone,
  Linkedin, Globe, MapPin, ChevronLeft, ChevronRight, Loader2,
  Building2, Users, Briefcase, Heart, Home, Sun, RefreshCw,
  Search, SlidersHorizontal, Check, X, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  getMarketplaceLeads, unlockMarketplaceLead, getMarketplaceStats,
  getUnlockedLeads, type MarketplaceLead, type MarketplaceStats,
} from "@/lib/api";

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",         label: "All Leads",             icon: Users,     color: "text-primary     bg-primary/10     border-primary/20" },
  { id: "insurance",   label: "Health & Life Insurance", icon: Heart,    color: "text-rose-400    bg-rose-500/10    border-rose-500/20" },
  { id: "real_estate", label: "Real Estate & Mortgage",  icon: Home,     color: "text-blue-400    bg-blue-500/10    border-blue-500/20" },
  { id: "solar",       label: "Solar",                  icon: Sun,      color: "text-yellow-400  bg-yellow-500/10  border-yellow-500/20" },
  { id: "business",    label: "Business / B2B",         icon: Briefcase, color: "text-purple-400  bg-purple-500/10  border-purple-500/20" },
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];

// ── CSV for unlocked leads ────────────────────────────────────────────────────
function downloadCSV(leads: MarketplaceLead[]) {
  const headers = ["Name","Title","Company","Email","Phone","City","State","Industry","Company Size","LinkedIn","Website"];
  const rows = leads.filter(l => l.is_unlocked).map(l => [
    l.display_name, l.title ?? "", l.company ?? "", l.email ?? "",
    l.phone ?? "", l.city ?? "", l.state ?? "", l.industry ?? "",
    l.company_size ? String(l.company_size) : "", l.linkedin_url ?? "", l.website ?? "",
  ]);
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: `marketplace-leads-${Date.now()}.csv`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast({ title: `✓ ${rows.length} leads downloaded` });
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({
  lead, onUnlock, unlocking,
}: {
  lead: MarketplaceLead;
  onUnlock: (id: number) => void;
  unlocking: number | null;
}) {
  const cat = CATEGORIES.find(c => c.id === lead.category) ?? CATEGORIES[0];
  const isUnlocking = unlocking === lead.id;

  return (
    <div className={cn(
      "rounded-2xl border bg-card/30 p-4 flex flex-col gap-3 transition-all duration-200",
      lead.is_unlocked
        ? "border-green-500/20 bg-green-500/5"
        : "border-border/30 hover:border-border/50 hover:bg-card/50"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold", cat.color.split(" ").slice(1).join(" "))}>
            {(lead.first_name?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{lead.display_name}</p>
            <p className="text-xs text-muted-foreground truncate">{lead.title || "—"}</p>
          </div>
        </div>
        <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0 border", cat.color)}>
          {cat.label.split(" ")[0]}
        </Badge>
      </div>

      {/* Company + Location */}
      <div className="space-y-1">
        {lead.company && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.company}</span>
            {lead.company_size && <span className="text-muted-foreground/50">· {lead.company_size.toLocaleString()} emp</span>}
          </div>
        )}
        {(lead.city || lead.state) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{[lead.city, lead.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {lead.industry && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.industry}</span>
          </div>
        )}
      </div>

      {/* Contact info (unlocked) */}
      {lead.is_unlocked && (
        <div className="space-y-1 pt-1 border-t border-border/20">
          {lead.email && (
            <button onClick={() => { navigator.clipboard.writeText(lead.email!); toast({ title: "Email copied" }); }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline w-full text-left truncate">
              <Mail className="h-3 w-3 shrink-0 text-blue-400" />
              {lead.email}
            </button>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0 text-green-400" />
              {lead.phone}
            </div>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            {lead.linkedin_url && (
              <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
                <Linkedin className="h-3 w-3" />
              </a>
            )}
            {lead.website && (
              <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/60 text-muted-foreground transition-colors">
                <Globe className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Footer action */}
      <div className="mt-auto pt-1">
        {lead.is_unlocked ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
            <Check className="h-3.5 w-3.5" /> Unlocked
          </div>
        ) : (
          <button
            onClick={() => onUnlock(lead.id)}
            disabled={isUnlocking}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-xs font-medium text-primary transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {isUnlocking
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Unlocking…</>
              : <><Coins className="h-3.5 w-3.5" /> Unlock · {lead.credits_cost} credits</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── Buy Credits Modal ─────────────────────────────────────────────────────────
function BuyCreditsModal({ onClose }: { onClose: () => void }) {
  const PACKAGES = [
    { credits: 50,  price: "$49",  per: "$0.98/lead", popular: false },
    { credits: 100, price: "$89",  per: "$0.89/lead", popular: true  },
    { credits: 250, price: "$199", per: "$0.80/lead", popular: false },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/30 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Buy Credits</h2>
            <p className="text-xs text-muted-foreground">Each credit unlocks one lead's full contact info</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {PACKAGES.map(pkg => (
            <button key={pkg.credits}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border transition-all hover:scale-[1.01]",
                pkg.popular
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/30 bg-secondary/20 hover:border-border/50"
              )}>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{pkg.credits} Credits</span>
                  {pkg.popular && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Most Popular</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{pkg.per}</p>
              </div>
              <span className="text-lg font-bold">{pkg.price}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-center text-muted-foreground">
          Payments handled securely via Stripe. Credits never expire.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadsAgent() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [leads, setLeads] = useState<MarketplaceLead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<number | null>(null);

  const [activeCategory, setActiveCategory] = useState("all");
  const [stateFilter, setStateFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [showDownloaded, setShowDownloaded] = useState(false);
  const [unlockedLeads, setUnlockedLeads] = useState<MarketplaceLead[]>([]);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const fetchLeads = useCallback(async (cat = activeCategory, st = stateFilter, pg = page) => {
    setLoading(true);
    try {
      const res = await getMarketplaceLeads({ category: cat, state: st, page: pg, per_page: 24 });
      setLeads(res.leads);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      toast({ title: "Failed to load leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeCategory, stateFilter, page]);

  const fetchStats = async () => {
    try { setStats(await getMarketplaceStats()); } catch {}
  };

  useEffect(() => {
    fetchStats();
    fetchLeads("all", "", 1);
  }, []);

  const handleCategory = (id: string) => {
    setActiveCategory(id);
    setPage(1);
    fetchLeads(id, stateFilter, 1);
  };

  const handleState = (st: string) => {
    setStateFilter(st);
    setPage(1);
    fetchLeads(activeCategory, st, 1);
  };

  const handlePage = (p: number) => {
    setPage(p);
    fetchLeads(activeCategory, stateFilter, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUnlock = async (id: number) => {
    setUnlocking(id);
    try {
      const res = await unlockMarketplaceLead(id);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...res.lead, is_unlocked: true } : l));
      setStats(prev => prev ? { ...prev, balance: res.credits_remaining, unlocked: prev.unlocked + 1 } : prev);
      toast({ title: "Lead unlocked ✓", description: `${res.credits_remaining} credits remaining` });
    } catch (e: any) {
      if (e.message?.includes("enough credits") || e.message?.includes("402")) {
        setShowBuyModal(true);
        toast({ title: "Not enough credits", description: "Purchase more credits to unlock this lead.", variant: "destructive" });
      } else {
        toast({ title: e.message || "Failed to unlock", variant: "destructive" });
      }
    } finally {
      setUnlocking(null);
    }
  };

  const handleDownloadAll = async () => {
    try {
      const all = await getUnlockedLeads();
      if (all.length === 0) { toast({ title: "No unlocked leads yet" }); return; }
      downloadCSV(all);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  // Client-side search filter
  const filtered = searchFilter.trim()
    ? leads.filter(l => {
        const q = searchFilter.toLowerCase();
        return l.display_name?.toLowerCase().includes(q)
          || l.company?.toLowerCase().includes(q)
          || l.title?.toLowerCase().includes(q)
          || l.industry?.toLowerCase().includes(q);
      })
    : leads;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

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
          <span className="text-sm font-bold">Lead Marketplace</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Credits balance */}
          <button onClick={() => setShowBuyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400 hover:bg-yellow-500/15 transition-colors">
            <Coins className="h-3.5 w-3.5" />
            {stats ? <><strong>{stats.balance}</strong> credits</> : "— credits"}
            <span className="text-yellow-400/60 ml-1">+ Buy</span>
          </button>
          {/* Download unlocked */}
          {stats && stats.unlocked > 0 && (
            <button onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400 hover:bg-green-500/15 transition-colors">
              <Download className="h-3.5 w-3.5" />
              Download ({stats.unlocked})
            </button>
          )}
          <button onClick={() => { fetchStats(); fetchLeads(); }}
            className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      {stats && (
        <div className="flex items-center gap-6 px-5 py-2.5 border-b border-border/20 bg-card/10 text-xs text-muted-foreground shrink-0 flex-wrap">
          <span><strong className="text-foreground">{stats.total.toLocaleString()}</strong> total leads</span>
          {Object.entries(stats.category_counts).map(([cat, count]) => {
            const c = CATEGORIES.find(x => x.id === cat);
            return c ? (
              <span key={cat}><strong className="text-foreground">{count}</strong> {c.label.split(" ")[0]}</span>
            ) : null;
          })}
          <span className="ml-auto"><strong className="text-green-400">{stats.unlocked}</strong> unlocked by you</span>
        </div>
      )}

      {/* ── Category Tabs ── */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/20 overflow-x-auto shrink-0">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = cat.id === "all" ? stats?.total : stats?.category_counts[cat.id];
          return (
            <button key={cat.id}
              onClick={() => handleCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border whitespace-nowrap transition-all",
                activeCategory === cat.id
                  ? cn("border", cat.color)
                  : "border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 bg-transparent"
              )}>
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
              {count !== undefined && (
                <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full",
                  activeCategory === cat.id ? "bg-current/10" : "bg-secondary/60 text-muted-foreground/70"
                )}>
                  {count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/20 bg-card/5 shrink-0">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search name, company, title…"
            className="h-8 pl-8 pr-3 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/40 w-56"
          />
        </div>
        {/* State */}
        <select
          value={stateFilter}
          onChange={e => handleState(e.target.value)}
          className="h-8 px-2 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/40 text-muted-foreground">
          <option value="">All States</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(stateFilter || searchFilter) && (
          <button onClick={() => { setStateFilter(""); setSearchFilter(""); handleState(""); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} of ${total} leads`}
        </div>
      </div>

      {/* ── Lead Grid ── */}
      <div className="flex-1 p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading leads…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Target className="h-12 w-12 text-muted-foreground/20" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">No leads found</p>
              <p className="text-xs text-muted-foreground/60">
                {total === 0
                  ? "This category hasn't been populated yet. Contact your admin."
                  : "Try adjusting your filters."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lead => (
                <LeadCard key={lead.id} lead={lead} onUnlock={handleUnlock} unlocking={unlocking} />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-border/30 hover:bg-secondary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => handlePage(p)}
                      className={cn(
                        "w-9 h-9 rounded-lg text-sm transition-colors",
                        p === page
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/30 hover:bg-secondary/40 text-muted-foreground"
                      )}>
                      {p}
                    </button>
                  );
                })}
                {pages > 7 && <span className="text-muted-foreground text-sm">…</span>}
                <button
                  onClick={() => handlePage(page + 1)}
                  disabled={page === pages}
                  className="p-2 rounded-lg border border-border/30 hover:bg-secondary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Buy Credits Modal ── */}
      {showBuyModal && <BuyCreditsModal onClose={() => setShowBuyModal(false)} />}
    </div>
  );
}

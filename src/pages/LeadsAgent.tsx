import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ShoppingCart, Coins, Download, Lock, Check,
  Mail, Phone, MapPin, ChevronLeft, ChevronRight, Loader2,
  Heart, Home, Sun, Briefcase, Shield, Car, Baby, Zap,
  SlidersHorizontal, X, RefreshCw, Users, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  getMarketplaceLeads, purchaseMarketplaceLead, getMarketplaceStats,
  getPurchasedLeads, type MarketplaceLead, type MarketplaceStats,
} from "@/lib/api";

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",          label: "All Leads",              icon: Users,   color: "bg-slate-500/10 text-slate-300 border-slate-500/30",   dot: "bg-slate-400" },
  { id: "health",       label: "Health Insurance",       icon: Heart,   color: "bg-rose-500/10  text-rose-300  border-rose-500/30",    dot: "bg-rose-400"  },
  { id: "life",         label: "Life Insurance",         icon: Shield,  color: "bg-blue-500/10  text-blue-300  border-blue-500/30",    dot: "bg-blue-400"  },
  { id: "medicare",     label: "Medicare",               icon: Baby,    color: "bg-teal-500/10  text-teal-300  border-teal-500/30",    dot: "bg-teal-400"  },
  { id: "auto",         label: "Auto Insurance",         icon: Car,     color: "bg-orange-500/10 text-orange-300 border-orange-500/30", dot: "bg-orange-400"},
  { id: "real_estate",  label: "Real Estate",            icon: Home,    color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30", dot: "bg-indigo-400"},
  { id: "mortgage",     label: "Mortgage",               icon: Home,    color: "bg-violet-500/10 text-violet-300 border-violet-500/30", dot: "bg-violet-400"},
  { id: "solar",        label: "Solar",                  icon: Sun,     color: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400"},
  { id: "business",     label: "Business",               icon: Briefcase, color: "bg-green-500/10 text-green-300 border-green-500/30", dot: "bg-green-400"},
  { id: "other",        label: "Other",                  icon: Zap,     color: "bg-gray-500/10  text-gray-300  border-gray-500/30",   dot: "bg-gray-400"  },
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

// ── CSV download ──────────────────────────────────────────────────────────────
function downloadCSV(leads: MarketplaceLead[]) {
  const cols = ["Name","Age","Gender","City","State","Zip","Interest","Email","Phone","Address","Notes"];
  const rows = leads.filter(l => l.is_purchased).map(l => [
    l.display_name, l.age ?? "", l.gender ?? "", l.city ?? "",
    l.state ?? "", l.zip_code ?? "", l.interest ?? "",
    l.email ?? "", l.phone ?? "", l.address ?? "", l.notes_private ?? "",
  ]);
  const e = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols, ...rows].map(r => r.map(e).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: `leads-${Date.now()}.csv`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast({ title: `✓ ${rows.length} leads downloaded` });
}

// ── Buy Credits Modal ─────────────────────────────────────────────────────────
function BuyCreditsModal({ onClose }: { onClose: () => void }) {
  const pkgs = [
    { credits: 50,  price: "$49",  label: "Starter",  per: "$0.98 / lead" },
    { credits: 100, price: "$89",  label: "Growth",   per: "$0.89 / lead", popular: true },
    { credits: 250, price: "$199", label: "Pro",       per: "$0.80 / lead" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/40 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Buy Credits</h2>
            <p className="text-xs text-muted-foreground mt-0.5">1 credit = 1 lead's full contact info</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4"/></button>
        </div>
        <div className="space-y-2.5">
          {pkgs.map(p => (
            <button key={p.credits}
              className={cn("w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all hover:scale-[1.01]",
                p.popular ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border/30 bg-secondary/20 hover:border-border/50")}>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.credits} Credits — {p.label}</span>
                  {p.popular && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 px-1.5">Popular</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.per}</p>
              </div>
              <span className="text-xl font-bold">{p.price}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-center text-muted-foreground">Secure payment via Stripe · Credits never expire</p>
      </div>
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onBuy, buying }: {
  lead: MarketplaceLead;
  onBuy: (id: number) => void;
  buying: number | null;
}) {
  const cat = CATEGORIES.find(c => c.id === lead.category) ?? CATEGORIES[0];
  const isBuying = buying === lead.id;

  return (
    <div className={cn(
      "rounded-xl border flex flex-col gap-0 overflow-hidden transition-all duration-200",
      lead.is_purchased
        ? "border-green-500/25 bg-green-500/5"
        : "border-border/30 bg-card/40 hover:border-border/50 hover:bg-card/60"
    )}>
      {/* Card top strip */}
      <div className={cn("h-1 w-full", cat.dot)} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border shrink-0", cat.color)}>
              {(lead.first_name?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{lead.display_name}</p>
              {lead.lead_type && <p className="text-xs text-muted-foreground">{lead.lead_type}</p>}
            </div>
          </div>
          <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0 border font-medium", cat.color)}>
            {cat.label}
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          {(lead.city || lead.state) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              {[lead.city, lead.state, lead.zip_code].filter(Boolean).join(", ")}
            </div>
          )}
          {lead.age && (
            <p className="text-xs text-muted-foreground">
              Age: <span className="text-foreground/80">{lead.age}</span>
              {lead.gender && <> · {lead.gender}</>}
            </p>
          )}
          {lead.interest && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              <span className="font-medium text-foreground/70">Looking for: </span>
              {lead.interest}
            </p>
          )}
          {lead.notes_public && (
            <p className="text-xs text-muted-foreground/70 italic line-clamp-2">{lead.notes_public}</p>
          )}
        </div>

        {/* Purchased — show contact */}
        {lead.is_purchased && (
          <div className="pt-2 border-t border-green-500/20 space-y-1.5">
            {lead.email && (
              <button onClick={() => { navigator.clipboard.writeText(lead.email!); toast({ title: "Email copied" }); }}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-full text-left">
                <Mail className="h-3 w-3 text-blue-400 shrink-0" />{lead.email}
              </button>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                <Phone className="h-3 w-3 text-green-400 shrink-0" />{lead.phone}
              </div>
            )}
            {lead.address && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />{lead.address}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-1">
          {lead.is_purchased ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
              <Check className="h-3.5 w-3.5" /> Purchased
            </div>
          ) : (
            <button
              onClick={() => onBuy(lead.id)}
              disabled={isBuying}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-60">
              {isBuying
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Purchasing…</>
                : <><ShoppingCart className="h-3.5 w-3.5" /> Get Contact Info · <Coins className="h-3 w-3" />{lead.credits_cost}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadsAgent() {
  const navigate = useNavigate();

  const [stats, setStats]           = useState<MarketplaceStats | null>(null);
  const [leads, setLeads]           = useState<MarketplaceLead[]>([]);
  const [total, setTotal]           = useState(0);
  const [pages, setPages]           = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [buying, setBuying]         = useState<number | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const [activeCategory, setActiveCategory] = useState("all");
  const [stateFilter, setStateFilter]       = useState("");
  const [typeFilter, setTypeFilter]         = useState("");

  const load = useCallback(async (cat = activeCategory, st = stateFilter, typ = typeFilter, pg = page) => {
    setLoading(true);
    try {
      const res = await getMarketplaceLeads({ category: cat, state: st, lead_type: typ, page: pg, per_page: 20 });
      setLeads(res.leads); setTotal(res.total); setPages(res.pages);
    } catch { toast({ title: "Failed to load leads", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [activeCategory, stateFilter, typeFilter, page]);

  useEffect(() => {
    getMarketplaceStats().then(setStats).catch(() => {});
    load("all", "", "", 1);
  }, []);

  const handleCategory = (id: string) => { setActiveCategory(id); setPage(1); load(id, stateFilter, typeFilter, 1); };
  const handleState    = (s: string)  => { setStateFilter(s);     setPage(1); load(activeCategory, s, typeFilter, 1); };
  const handleType     = (t: string)  => { setTypeFilter(t);      setPage(1); load(activeCategory, stateFilter, t, 1); };
  const handlePage     = (p: number)  => { setPage(p); load(activeCategory, stateFilter, typeFilter, p); window.scrollTo({ top: 0 }); };

  const handleBuy = async (id: number) => {
    setBuying(id);
    try {
      const res = await purchaseMarketplaceLead(id);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...res.lead, is_purchased: true } : l));
      setStats(prev => prev ? { ...prev, balance: res.credits_remaining, purchased: prev.purchased + 1 } : prev);
      toast({ title: "Lead purchased ✓", description: `${res.credits_remaining} credits remaining` });
    } catch (e: any) {
      if (e.message?.includes("enough credits") || e.message?.startsWith("402")) {
        setShowBuyModal(true);
      } else {
        toast({ title: e.message || "Failed", variant: "destructive" });
      }
    } finally { setBuying(null); }
  };

  const handleDownloadAll = async () => {
    try {
      const all = await getPurchasedLeads();
      if (!all.length) { toast({ title: "No purchased leads yet" }); return; }
      downloadCSV(all);
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  const clearFilters = () => { setStateFilter(""); setTypeFilter(""); load(activeCategory, "", "", 1); };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm">
        <button onClick={() => navigate("/workflow")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
        <div className="w-px h-4 bg-border/40" />
        <span className="text-sm font-bold">Lead Marketplace</span>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowBuyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-xs text-yellow-300 hover:bg-yellow-500/15 transition-colors font-medium">
            <Coins className="h-3.5 w-3.5" />
            {stats ? <><strong>{stats.balance}</strong> credits</> : "— credits"}
            <span className="opacity-60 ml-1">Buy →</span>
          </button>
          {stats && stats.purchased > 0 && (
            <button onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/25 text-xs text-green-300 hover:bg-green-500/15 transition-colors font-medium">
              <Download className="h-3.5 w-3.5" /> Download ({stats.purchased})
            </button>
          )}
          <button onClick={() => { getMarketplaceStats().then(setStats).catch(() => {}); load(); }}
            className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">

        {/* ── Left Sidebar — Categories ── */}
        <div className="w-52 shrink-0 border-r border-border/25 bg-card/10 overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-1">Lead Type</p>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = cat.id === "all" ? stats?.total : stats?.category_counts[cat.id];
            return (
              <button key={cat.id}
                onClick={() => handleCategory(cat.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all",
                  activeCategory === cat.id
                    ? cn("border", cat.color)
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                )}>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {cat.label}
                </div>
                {count !== undefined && count > 0 && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    activeCategory === cat.id ? "bg-white/10" : "bg-secondary/60 text-muted-foreground/60")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Stats */}
          {stats && (
            <div className="pt-4 border-t border-border/20 space-y-2 px-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your Account</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Credits</span><strong className="text-yellow-300">{stats.balance}</strong></div>
                <div className="flex justify-between"><span>Purchased</span><strong className="text-green-300">{stats.purchased}</strong></div>
                <div className="flex justify-between"><span>Available</span><strong className="text-foreground">{stats.total}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Filter bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/20 bg-card/5 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <select value={stateFilter} onChange={e => handleState(e.target.value)}
              className="h-8 px-2 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/40 text-muted-foreground max-w-[160px]">
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              value={typeFilter}
              onChange={e => handleType(e.target.value)}
              placeholder="Filter by type…"
              className="h-8 px-3 rounded-lg bg-secondary/30 border border-border/30 text-xs focus:outline-none focus:border-primary/40 w-40"
            />
            {(stateFilter || typeFilter) && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {loading ? "Loading…" : <><strong className="text-foreground">{total.toLocaleString()}</strong> leads</>}
            </span>
          </div>

          {/* Lead grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading leads…</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
                <Tag className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground">No leads available yet</p>
                <p className="text-xs text-muted-foreground/60">Check back soon — new leads are added regularly.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {leads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onBuy={handleBuy} buying={buying} />
                  ))}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                    <button onClick={() => handlePage(page - 1)} disabled={page === 1}
                      className="p-2 rounded-lg border border-border/30 hover:bg-secondary/40 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => handlePage(p)}
                        className={cn("w-9 h-9 rounded-lg text-sm transition-colors font-medium",
                          p === page ? "bg-primary text-primary-foreground" : "border border-border/30 hover:bg-secondary/40 text-muted-foreground")}>
                        {p}
                      </button>
                    ))}
                    {pages > 7 && <span className="text-muted-foreground text-sm px-1">…</span>}
                    <button onClick={() => handlePage(page + 1)} disabled={page === pages}
                      className="p-2 rounded-lg border border-border/30 hover:bg-secondary/40 disabled:opacity-30 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showBuyModal && <BuyCreditsModal onClose={() => setShowBuyModal(false)} />}
    </div>
  );
}

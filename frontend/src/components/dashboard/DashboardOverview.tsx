import { useState } from "react";
import { motion } from "framer-motion";
import { PhoneCall, CalendarCheck, DollarSign, Wallet, TrendingUp, TrendingDown, Activity, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: string; up: boolean };
  glowColor?: string;
}

function KPICard({ label, value, subtitle, icon: Icon, trend, glowColor = "primary" }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 hover:border-primary/30 transition-all duration-300"
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%, hsl(var(--${glowColor}) / 0.06) 0%, transparent 70%)` }}
      />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs font-medium", trend.up ? "text-success" : "text-destructive")}>
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}
            </div>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 border border-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}

interface AgentStatusProps {
  agents: any[];
}

function AgentStatusIndicator({ agents }: AgentStatusProps) {
  const hasPublished = agents.length > 0;
  const lastAgent = agents[agents.length - 1];
  const lastUpdated = lastAgent?.updated_at
    ? new Date(lastAgent.updated_at).toLocaleString()
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">AI Agent Status</h3>
      <div className="flex items-center gap-3">
        <div className={cn(
          "relative flex h-3 w-3 rounded-full",
          hasPublished ? "bg-success" : "bg-muted-foreground"
        )}>
          {hasPublished && (
            <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-40" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {hasPublished ? "Live" : "No agents published"}
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">Last published: {lastUpdated}</p>
          )}
        </div>
      </div>
      {agents.length > 0 && (
        <div className="mt-4 space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/30">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{agent.assistant_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{agent.phone_number || "No number"}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface DashboardOverviewProps {
  balance: number | null;
  lowBalance: boolean;
  usage: any;
  calls: any[];
  agents: any[];
  transactions: any[];
}

export default function DashboardOverview({ balance, lowBalance, usage, calls, agents, transactions }: DashboardOverviewProps) {
  const callsToday = calls.filter((c: any) => {
    const d = c.created_at ? new Date(c.created_at) : null;
    if (!d) return false;
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const totalCalls = usage?.total_calls ?? 0;
  const totalMinutes = (usage?.total_minutes ?? 0).toFixed(1);
  const totalSpent = (usage?.total_revenue_usd ?? 0).toFixed(2);

  // Call logs from transactions
  const callTxs = transactions.filter((tx: any) => tx.description?.startsWith("Call to "));

  // Group calls by day for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });

  const callsByDay = last7Days.map((day) => ({
    day: new Date(day).toLocaleDateString("en", { weekday: "short" }),
    count: callTxs.filter((tx: any) => {
      const d = tx.created_at ? new Date(tx.created_at.endsWith("Z") ? tx.created_at : tx.created_at + "Z") : null;
      return d && d.toDateString() === day;
    }).length,
  }));

  const maxCalls = Math.max(...callsByDay.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      {/* Low balance warning */}
      {lowBalance && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 backdrop-blur-xl p-4"
        >
          <Wallet className="h-5 w-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning">Credits running low</p>
            <p className="text-xs text-muted-foreground">Recharge to avoid service interruption</p>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Calls Today"
          value={String(callsToday)}
          subtitle="Inbound calls handled"
          icon={PhoneCall}
          glowColor="primary"
        />
        <KPICard
          label="Total Calls"
          value={String(totalCalls)}
          subtitle={`${totalMinutes} minutes total`}
          icon={CalendarCheck}
          glowColor="accent"
        />
        <KPICard
          label="Total Spent"
          value={`$${totalSpent}`}
          subtitle="Usage charges"
          icon={DollarSign}
          glowColor="primary"
        />
        <KPICard
          label="Credit Balance"
          value={`$${balance?.toFixed(2) ?? "0.00"}`}
          subtitle={lowBalance ? "⚠ Low balance" : "Available credits"}
          icon={Wallet}
          glowColor="primary"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calls per day chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6"
        >
          <h3 className="text-sm font-semibold text-foreground mb-6">Calls — Last 7 Days</h3>
          <div className="flex items-end gap-3 h-40">
            {callsByDay.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative flex flex-col items-center justify-end" style={{ height: "120px" }}>
                  <span className="text-xs font-semibold text-foreground mb-1">{d.count}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max((d.count / maxCalls) * 100, 4)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className="w-full max-w-[32px] rounded-t-lg"
                    style={{ background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.4) 100%)" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{d.day}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Agent Status */}
        <AgentStatusIndicator agents={agents} />
      </div>

      {/* Call History */}
      <CallHistory callTxs={callTxs} agents={agents} />
    </div>
  );
}

function CallHistory({ callTxs, agents }: { callTxs: any[]; agents: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Call History</h3>
      {callTxs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No call activity yet. Publish an agent to start receiving calls.</p>
      ) : (
        <div className="space-y-2">
          {callTxs.map((tx: any, i: number) => {
            const id = tx.id || String(i);
            const isExpanded = expandedId === id;
            const hasBreakdown = tx.openai_cost != null || tx.elevenlabs_cost != null || tx.markup != null || tx.duration_seconds != null;

            return (
              <div key={id} className="rounded-xl bg-secondary/20 border border-border/20 hover:border-border/40 transition-colors">
                <button
                  onClick={() => hasBreakdown && setExpandedId(isExpanded ? null : id)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <PhoneCall className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{tx.description || "Call"}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {tx.created_at ? new Date(tx.created_at.endsWith("Z") ? tx.created_at : tx.created_at + "Z").toLocaleString() : "—"}
                        </p>
                        {tx.duration_seconds != null && (
                          <span className="text-xs text-muted-foreground">• {formatDuration(tx.duration_seconds)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-destructive">−${Math.abs(tx.amount).toFixed(2)}</span>
                    {hasBreakdown && (
                      isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && hasBreakdown && (
                  <div className="px-4 pb-4 pt-0 ml-[52px]">
                    <div className="rounded-lg bg-background/50 border border-border/20 p-3 space-y-1.5 text-xs">
                      {tx.openai_cost != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">OpenAI cost</span>
                          <span className="text-foreground font-medium">${Number(tx.openai_cost).toFixed(4)}</span>
                        </div>
                      )}
                      {tx.elevenlabs_cost != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ElevenLabs cost</span>
                          <span className="text-foreground font-medium">${Number(tx.elevenlabs_cost).toFixed(4)}</span>
                        </div>
                      )}
                      {(tx.openai_cost != null || tx.elevenlabs_cost != null) && (
                        <div className="flex justify-between border-t border-border/20 pt-1.5">
                          <span className="text-muted-foreground">API subtotal</span>
                          <span className="text-foreground font-medium">
                            ${((Number(tx.openai_cost) || 0) + (Number(tx.elevenlabs_cost) || 0)).toFixed(4)}
                          </span>
                        </div>
                      )}
                      {tx.markup != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Service fee ($0.05/min)</span>
                          <span className="text-foreground font-medium">${Number(tx.markup).toFixed(4)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-border/20 pt-1.5 font-semibold">
                        <span className="text-foreground">Total charged</span>
                        <span className="text-destructive">${Math.abs(tx.amount).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

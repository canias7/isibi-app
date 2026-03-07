import { useState } from "react";
import { motion } from "framer-motion";
import { PhoneCall, Clock, DollarSign, ChevronDown, ChevronUp } from "lucide-react";

interface DashboardCallsProps {
  transactions: any[];
  usage: any;
}

export default function DashboardCalls({ transactions, usage }: DashboardCallsProps) {
  const callTxs = transactions.filter((tx: any) => tx.description?.startsWith("Call to "));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Call History</h2>
        <p className="text-sm text-muted-foreground mt-1">View all calls handled by your AI agents.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <PhoneCall className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Calls</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{usage?.total_calls ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Minutes</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{(usage?.total_minutes ?? 0).toFixed(1)}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-foreground">${(usage?.total_revenue_usd ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Pricing info */}
      <div className="rounded-xl border border-border/30 bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Pricing: Actual API costs (OpenAI + ElevenLabs) + <span className="font-semibold text-foreground">$0.05/min</span> service fee
        </p>
      </div>

      {/* Call list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6"
      >
        {callTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No calls recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {callTxs.map((tx: any, i: number) => {
              const id = tx.id || String(i);
              const isExpanded = expandedId === id;
              const hasBreakdown = tx.openai_cost != null || tx.elevenlabs_cost != null || tx.markup != null || tx.duration_seconds != null;

              return (
                <div key={id} className="rounded-xl bg-secondary/20 border border-border/20 hover:border-border/40 transition-colors">
                  <button
                    onClick={() => hasBreakdown && toggleExpand(id)}
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

                  {/* Cost breakdown */}
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
    </div>
  );
}

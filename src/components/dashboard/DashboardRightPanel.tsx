import { useState } from "react";
import { cn } from "@/lib/utils";
import { DollarSign, PhoneCall, ChevronDown, ChevronUp } from "lucide-react";
import PricingEstimator from "./PricingEstimator";
import { FIXED_COSTS, getEstimatedRange, getTranscriberLabel, getModelLabel, getVoiceLabel } from "@/lib/pricing";

export type RightPanelTab = "pricing";

export interface AgentConfigForPricing {
  transcriberModel?: string;
  llmModel?: string;
  voiceProvider?: string;
}

interface DashboardRightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  agentConfig?: AgentConfigForPricing;
  calls?: any[];
}

const tabs: { id: RightPanelTab; label: string; icon: React.ElementType }[] = [
  { id: "pricing", label: "Pricing", icon: DollarSign },
];

function CallBreakdownItem({ call }: { call: any }) {
  const [open, setOpen] = useState(false);

  const durationMin = (call.duration_seconds || 0) / 60;
  const totalRevenue = call.revenue_usd ?? 0;
  const isibiCost = durationMin * FIXED_COSTS.isibi;
  const twilioCost = call.revenue_twilio_phone ?? call.cost_twilio_phone ?? (durationMin * FIXED_COSTS.twilio);

  // Use API granular costs if available, otherwise estimate from pricing rates
  const hasGranularCosts = (call.cost_input_audio ?? 0) > 0 || (call.cost_input_tokens ?? 0) > 0 || (call.cost_output_tokens ?? 0) > 0 || (call.cost_output_audio ?? 0) > 0;

  let transcriberCost: number;
  let modelCost: number;
  let voiceCost: number;

  if (hasGranularCosts) {
    transcriberCost = call.revenue_input_audio ?? call.cost_input_audio ?? 0;
    modelCost = (call.revenue_input_tokens ?? call.cost_input_tokens ?? 0) + (call.revenue_output_tokens ?? call.cost_output_tokens ?? 0) + (call.revenue_output_audio ?? call.cost_output_audio ?? 0);
    voiceCost = Math.max(totalRevenue - isibiCost - twilioCost - transcriberCost - modelCost, 0);
  } else {
    // Estimate proportionally from pricing rates using midpoints
    const remainder = Math.max(totalRevenue - isibiCost - twilioCost, 0);
    // Default rate midpoints: transcriber $0.01, model $0.05, voice $0.045
    const tRate = 0.01, mRate = 0.05, vRate = 0.045;
    const rateSum = tRate + mRate + vRate;
    transcriberCost = remainder * (tRate / rateSum);
    modelCost = remainder * (mRate / rateSum);
    voiceCost = remainder * (vRate / rateSum);
  }

  const transcriberName = call.transcriber_model ? getTranscriberLabel(call.transcriber_model) : "Transcriber";
  const modelName = call.llm_model ? getModelLabel(call.llm_model) : "Model";
  const voiceName = call.voice_provider ? getVoiceLabel(call.voice_provider) : "Voice";

  const lines = [
    { label: "ISIBI Platform Fee", value: isibiCost, color: "bg-rose-500", detail: `${durationMin.toFixed(2)} min × $${FIXED_COSTS.isibi}/min` },
    { label: "Twilio Phone", value: twilioCost, color: "bg-sky-400", detail: null },
    { label: transcriberName, value: transcriberCost, color: "bg-amber-400", detail: `~${durationMin.toFixed(2)} min` },
    { label: modelName, value: modelCost, color: "bg-indigo-500", detail: (call.input_tokens || call.output_tokens) ? `${call.input_tokens ?? 0} in / ${call.output_tokens ?? 0} out tokens` : `~${durationMin.toFixed(2)} min` },
    { label: voiceName, value: voiceCost, color: "bg-teal-500", detail: `~${durationMin.toFixed(2)} min` },
  ];

  return (
    <div className="rounded-lg border border-border/20 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2 hover:bg-secondary/30 transition-colors"
      >
        <div className="min-w-0 flex-1 text-left">
          <p className="text-foreground font-medium truncate text-xs">{call.agent_name || "Unknown"}</p>
          <p className="text-[10px] text-muted-foreground">
            {call.duration_seconds ? `${call.duration_seconds}s` : "—"} · {call.started_at ? new Date(call.started_at.endsWith("Z") ? call.started_at : call.started_at + "Z").toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-destructive font-semibold text-xs">
            −${Math.abs(totalRevenue).toFixed(4)}
          </span>
          {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1 border-t border-border/20 pt-1.5">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", l.color)} />
                <div className="min-w-0">
                  <span className="block">{l.label}</span>
                  {l.detail && <span className="text-[9px] opacity-70">{l.detail}</span>}
                </div>
              </div>
              <span className="font-medium text-foreground shrink-0 ml-2">${l.value.toFixed(4)}</span>
            </div>
          ))}
          <div className="border-t border-border/20 pt-1 flex justify-between text-[11px] font-semibold text-foreground">
            <span>Total Charged</span>
            <span>${Math.abs(totalRevenue).toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardRightPanel({ activeTab, onTabChange, agentConfig, calls = [] }: DashboardRightPanelProps) {
  return (
    <aside className="w-[22rem] xl:w-[25rem] shrink-0 border-l border-border/30 bg-card/30 backdrop-blur-xl h-screen sticky top-0 flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 h-16 border-b border-border/30 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-primary/10 text-primary border border-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "pricing" && (
          <>
            <PricingEstimator
              transcriberModel={agentConfig?.transcriberModel}
              llmModel={agentConfig?.llmModel}
              voiceProvider={agentConfig?.voiceProvider}
            />

            {/* Call Logs Breakdown */}
            <div className="mt-6 rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Call Logs Breakdown</p>
              </div>
              {calls.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No calls yet</p>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {calls.map((call: any, i: number) => (
                    <CallBreakdownItem key={call.id || i} call={call} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

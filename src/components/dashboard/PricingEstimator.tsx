import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FIXED_COSTS,
  getTranscriberLabel, getTranscriberPrice,
  getModelLabel, getModelPrice,
  getVoiceLabel, getVoicePrice,
  formatRange,
} from "@/lib/pricing";

interface PricingEstimatorProps {
  transcriberModel?: string;
  llmModel?: string;
  voiceProvider?: string;
}

export default function PricingEstimator({
  transcriberModel = "whisper-1",
  llmModel = "gpt-realtime-2025-08-28",
  voiceProvider = "elevenlabs",
}: PricingEstimatorProps) {
  const lines = useMemo(() => [
    { label: "ISIBI", value: `$${FIXED_COSTS.isibi}/min`, color: "bg-rose-500" },
    { label: "Twilio", value: `$${FIXED_COSTS.twilio}/min`, color: "bg-sky-400" },
    { label: `Transcriber (${getTranscriberLabel(transcriberModel)})`, value: getTranscriberPrice(transcriberModel), color: "bg-amber-400" },
    { label: `Model (${getModelLabel(llmModel)})`, value: getModelPrice(llmModel), color: "bg-indigo-500" },
    { label: `Voice (${getVoiceLabel(voiceProvider)})`, value: getVoicePrice(voiceProvider), color: "bg-teal-500" },
  ], [transcriberModel, llmModel, voiceProvider]);

  const total = formatRange({ transcriberModel, llmModel, voiceProvider });

  // Midpoint values for proportional bar sizing
  const barWeights = useMemo(() => {
    const midpoints = lines.map((l) => {
      const clean = l.value.replace(/[$/min]/g, "");
      const parts = clean.split("–");
      const mid = parts.length === 2 ? (parseFloat(parts[0]) + parseFloat(parts[1])) / 2 : parseFloat(clean);
      return mid || 0.001;
    });
    const sum = midpoints.reduce((a, b) => a + b, 0);
    return midpoints.map((m) => (m / sum) * 100);
  }, [lines]);

  return (
    <div className="space-y-5">
      <div className="text-center py-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Estimated Cost</p>
        <p className="text-2xl font-bold text-foreground">{total}</p>
      </div>

      <div className="flex h-3 rounded-full overflow-hidden bg-secondary/40">
        {lines.map((line, i) => (
          <div
            key={line.label}
            className={cn("transition-all duration-300", line.color)}
            style={{ width: `${barWeights[i]}%` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center gap-1.5">
            <div className={cn("h-2 w-2 rounded-full", line.color)} />
            <span className="text-[10px] text-muted-foreground">{line.label.split(" (")[0]}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cost Breakdown</p>
        <div className="space-y-1.5 text-xs">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className={cn("h-2 w-2 rounded-full shrink-0", line.color)} />
                <span className="truncate">{line.label}</span>
              </div>
              <span className="font-medium text-foreground shrink-0 ml-2">{line.value}</span>
            </div>
          ))}
          <div className="border-t border-border/30 pt-1.5 flex justify-between font-semibold text-foreground">
            <span>Total</span>
            <span>{total}</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Estimates vary by usage, response length, and caching. Actual costs may differ.
      </p>
    </div>
  );
}

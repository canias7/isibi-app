import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Light / dark / match-this-device.
 *
 * THREE OPTIONS, AND "SYSTEM" IS THE DEFAULT. A two-way toggle forces a
 * choice most people never made — their device already knows, and following
 * it means the site goes dark at night with everything else. "System" is
 * worded as what it does ("Match this device"), not as jargon.
 *
 * THE PREVIEWS ARE DRAWN, NOT DESCRIBED — three mini windows showing the
 * actual grounds, because "dark" tells you less than seeing it. The system
 * one is split diagonally: it is honestly both.
 *
 * Selection is a real radio group (arrow keys work); the choice is the
 * caller's to store and apply — this component does not write classes to
 * <html> behind the caller's back.
 */
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function Mini({ mode }: { mode: "light" | "dark" | "system" }) {
  return (
    <svg data-slot="mini" viewBox="0 0 48 32" aria-hidden className="h-8 w-12 rounded border border-border">
      {mode !== "dark" ? <rect width="48" height="32" fill="#ffffff" /> : null}
      {mode !== "light" ? (
        mode === "dark"
          ? <rect width="48" height="32" fill="#1c1c1f" />
          : <path d="M48 0 L48 32 L0 32 Z" fill="#1c1c1f" />
      ) : null}
      <rect x="5" y="5" width="18" height="3" rx="1.5" fill={mode === "dark" ? "#e6e6e6" : "#26262a"} />
      <rect x="5" y="11" width="26" height="2" rx="1" fill="#8a8a8f" />
      <rect x="5" y="15" width="22" height="2" rx="1" fill="#8a8a8f" />
      {mode === "system" ? <rect x="28" y="22" width="14" height="2" rx="1" fill="#e6e6e6" /> : null}
    </svg>
  );
}

const OPTIONS = [
  { v: "system", label: "Match this device" },
  { v: "light", label: "Light" },
  { v: "dark", label: "Dark" },
] as const;

export function ThemePicker({ value = "system", onChange, className }: {
  value?: "light" | "dark" | "system";
  onChange: (v: "light" | "dark" | "system") => void;
  className?: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as "light" | "dark" | "system")}
      className={cn("flex gap-2", className)}>
      {OPTIONS.map((o) => (
        <label key={o.v}
          className={cn("flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2.5",
            value === o.v ? "border-foreground" : "border-border hover:bg-muted/50",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring")}>
          <RadioGroupItem value={o.v} className="sr-only" />
          <Mini mode={o.v} />
          <span className={cn("text-xs", value === o.v ? "font-semibold" : "text-muted-foreground")}>{o.label}</span>
        </label>
      ))}
    </RadioGroup>
  );
}

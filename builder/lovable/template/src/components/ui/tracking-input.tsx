import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Paste a tracking number — carrier detected from its shape.
 *
 * ASKING SOMEBODY TO PICK THE CARRIER FIRST IS BACKWARDS: the number is
 * what they have in their hand, and most carriers' numbers are recognisable
 * by pattern. Detection is a GUESS and is shown as one, with the picker
 * still there to correct it — the nl-date-input contract.
 *
 * SPACES AND HYPHENS ARE STRIPPED because tracking numbers are printed in
 * groups and copied with them, and a whitespace mismatch failing silently is
 * the commonest false negative.
 *
 * `detectCarrier` is exported and pure, so the patterns can be tested and
 * extended without touching the component.
 */
export const CARRIER_PATTERNS: { key: string; label: string; re: RegExp }[] = [
  { key: "royalmail", label: "Royal Mail", re: /^[A-Z]{2}\d{9}GB$/ },
  { key: "ups", label: "UPS", re: /^1Z[0-9A-Z]{16}$/ },
  { key: "fedex", label: "FedEx", re: /^(\d{12}|\d{15})$/ },
  { key: "dhl", label: "DHL", re: /^\d{10}$/ },
  { key: "evri", label: "Evri", re: /^H[0-9A-Z]{15}$/ },
];

export function detectCarrier(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "").toUpperCase();
  return CARRIER_PATTERNS.find((c) => c.re.test(v))?.key ?? null;
}

export function TrackingInput({ value, carrier, onChange, className }: {
  value: string;
  carrier?: string;
  onChange: (v: { value: string; carrier?: string }) => void;
  className?: string;
}) {
  const guess = detectCarrier(value);
  const shown = carrier ?? guess ?? "";
  const guessed = !carrier && !!guess;

  return (
    <div data-slot="tracking-input" className={cn("flex flex-col gap-1", className)}>
      <label className="flex flex-col gap-1 text-sm">
        Tracking number
        <input value={value}
          onChange={(e) => onChange({ value: e.target.value.replace(/[\s-]/g, "").toUpperCase(), carrier })}
          className="h-9 rounded-md border border-input bg-background px-2.5 font-mono text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <div className="flex items-center gap-2">
        <select value={shown} onChange={(e) => onChange({ value, carrier: e.target.value || undefined })}
          aria-label="Carrier"
          className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">Choose a carrier</option>
          {CARRIER_PATTERNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {/* Shown as a guess, correctable - never silently applied. */}
        {guessed ? <span className="text-[11px] text-muted-foreground">detected from the number — change it if that is wrong</span> : null}
        {value && !guess && !carrier ? <span className="text-[11px] text-muted-foreground">not a shape we recognise — pick the carrier</span> : null}
      </div>
    </div>
  );
}

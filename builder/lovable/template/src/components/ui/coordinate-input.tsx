import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Latitude and longitude, typed or pasted.
 *
 * PASTING A PAIR INTO EITHER FIELD FILLS BOTH. The real workflow is
 * copying "51.5074, -0.1278" out of another map's UI; making somebody
 * split it by hand across two boxes is the component ignoring how the
 * value actually arrives. The parser takes comma or whitespace pairs.
 *
 * LATITUDE IS FIRST AND LABELLED, always — half the world's tools say
 * lat,lng and the other half lng,lat, and a silent swap puts the shop
 * in the sea. The labels are the defence; the order never flips.
 *
 * RANGES ARE ENFORCED AT BLUR (±90, ±180), refusing with the limit
 * stated — not at keystroke, where "-" and "8" are both en route to
 * "-84.2" (the currency-input lesson: partial input is not wrong yet).
 */
export function parseCoordPair(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function CoordinateInput({ value, onChange, className }: {
  value: { lat?: number; lng?: number };
  onChange: (v: { lat?: number; lng?: number }) => void;
  className?: string;
}) {
  const [latText, setLatText] = React.useState(value.lat?.toString() ?? "");
  const [lngText, setLngText] = React.useState(value.lng?.toString() ?? "");
  const [refused, setRefused] = React.useState<string | null>(null);

  const paste = (e: React.ClipboardEvent) => {
    const pair = parseCoordPair(e.clipboardData.getData("text"));
    if (!pair) return; // an ordinary paste stays an ordinary paste
    e.preventDefault();
    setLatText(String(pair.lat)); setLngText(String(pair.lng));
    setRefused(null);
    onChange(pair);
  };
  const commit = (which: "lat" | "lng", text: string) => {
    const n = Number(text);
    if (text.trim() === "" || Number.isNaN(n)) { onChange({ ...value, [which]: undefined }); return; }
    const limit = which === "lat" ? 90 : 180;
    if (Math.abs(n) > limit) { setRefused(`${which === "lat" ? "Latitude" : "Longitude"} runs -${limit} to ${limit}.`); return; }
    setRefused(null);
    onChange({ ...value, [which]: n });
  };
  const field = "h-9 w-28 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Latitude
          <input value={latText} inputMode="decimal" onPaste={paste}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={() => commit("lat", latText)}
            className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Longitude
          <input value={lngText} inputMode="decimal" onPaste={paste}
            onChange={(e) => setLngText(e.target.value)}
            onBlur={() => commit("lng", lngText)}
            className={field} />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {refused ?? "Paste a “lat, lng” pair into either box and both fill."}
      </p>
    </div>
  );
}

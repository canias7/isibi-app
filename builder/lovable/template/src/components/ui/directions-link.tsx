import { cn } from "@/lib/utils";
/**
 * "Get directions" that opens whichever maps app the reader actually has.
 *
 * A `geo:` URI ON A PHONE, A WEB MAP EVERYWHERE ELSE. `geo:` is the platform
 * handoff — Android offers the reader's own map apps, and iOS opens Maps — so
 * nobody is forced into a particular vendor. Desktop has no handler for it, so
 * there the link falls back to a plain web map URL.
 *
 * COORDINATES WIN OVER THE ADDRESS when both are given, because a typed address
 * is ambiguous ("High Street" exists in every town) and a pin is not. The
 * address rides along as the label so the destination is still recognisable
 * once the map opens.
 *
 * THE ADDRESS IS ALSO PLAIN TEXT NEXT TO IT, always. A directions link on a
 * device with no map app is a dead end, and somebody reading a printout needs
 * the address itself. This is the one component here where the fallback is the
 * more important half.
 *
 * `rel="noreferrer"` on the external link — a map URL carries the destination,
 * and the referrer would hand the origin page along with it.
 */
export function DirectionsLink({ lat, lng, address, label = "Get directions", showAddress = true, className }: {
  lat?: number;
  lng?: number;
  address?: string;
  label?: string;
  showAddress?: boolean;
  className?: string;
}) {
  const hasPin = typeof lat === "number" && typeof lng === "number";
  if (!hasPin && !address) return null;
  const query = hasPin ? `${lat},${lng}` : address!;
  const geo = hasPin
    ? `geo:${lat},${lng}${address ? `?q=${encodeURIComponent(address)}` : ""}`
    : `geo:0,0?q=${encodeURIComponent(address!)}`;
  const web = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(pointer: coarse)").matches
    : false;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm", className)}>
      {showAddress && address && <span>{address}</span>}
      <a href={coarse ? geo : web} target={coarse ? undefined : "_blank"} rel="noreferrer"
        className="underline underline-offset-2">
        {label}
      </a>
    </span>
  );
}

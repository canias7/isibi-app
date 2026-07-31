import { Footprints, Car, Bus, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "8 min walk · 4 min drive."
 *
 * Each mode carries its WORD as well as its icon. A row of small pictograms
 * is guessed at — the walking figure and the running figure are the same
 * shape at 14px — and means nothing at all read aloud.
 */
export function TravelTime({ modes, className }: {
  modes: { mode: "walk" | "drive" | "transit" | "cycle"; minutes: number }[];
  className?: string;
}) {
  const map = {
    walk: { icon: Footprints, label: "walk" },
    drive: { icon: Car, label: "drive" },
    transit: { icon: Bus, label: "by bus" },
    cycle: { icon: Bike, label: "cycle" },
  };
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground", className)}>
      {modes.map((m) => {
        const { icon: Icon, label } = map[m.mode];
        return (
          <li key={m.mode} className="flex items-center gap-1.5">
            <Icon className="size-3.5" />
            <span className="tabular-nums">{Math.round(m.minutes)} min</span> {label}
          </li>
        );
      })}
    </ul>
  );
}

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * Give to a cause.
 *
 * The preset amounts are a real control and "other" is an input beside them,
 * not a second screen. Every extra step between deciding to give and giving
 * loses people, and the amount box is the step most often hidden.
 */
export function DonationCard({ title, raised, goal, currency = "£", presets = [10, 25, 50, 100],
  onDonate, className }: {
  title: string; raised?: number; goal?: number; currency?: string;
  presets?: number[]; onDonate?: (amount: number) => void; className?: string;
}) {
  const [amount, setAmount] = React.useState<number | null>(presets[1] ?? null);
  const [other, setOther] = React.useState("");
  const pct = goal ? Math.min(100, ((raised ?? 0) / goal) * 100) : null;
  const chosen = other ? Number(other) : amount;
  return (
    <div className={cn("space-y-4 rounded-lg border border-border p-4", className)}>
      <h3 className="text-sm font-medium">{title}</h3>
      {pct != null && (
        <div className="space-y-1.5">
          <Progress value={pct} className="h-2" />
          <p className="text-sm tabular-nums text-muted-foreground">
            <strong className="text-foreground">{currency}{(raised ?? 0).toLocaleString()}</strong>
            {" "}of {currency}{goal?.toLocaleString()}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p} type="button" size="sm" variant={!other && amount === p ? "default" : "outline"}
            onClick={() => { setAmount(p); setOther(""); }}>
            {currency}{p}
          </Button>
        ))}
        <Input inputMode="decimal" placeholder="Other" value={other} aria-label="Other amount"
          className="h-8 w-24 tabular-nums" onChange={(e) => setOther(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>
      <Button className="w-full" disabled={!chosen || chosen <= 0}
        onClick={() => chosen && onDonate?.(chosen)}>
        Donate {chosen && chosen > 0 ? `${currency}${chosen}` : ""}
      </Button>
    </div>
  );
}

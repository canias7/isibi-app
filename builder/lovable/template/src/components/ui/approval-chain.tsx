import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Who has signed off and who has not.
 *
 * A REJECTION stops the chain, and the steps after it are shown greyed rather
 * than as still-waiting. "Waiting on Grace" under a rejection somebody else
 * already made is how a request sits untouched for a week while everyone
 * assumes it is moving.
 *
 * Each step carries an icon shape and a word, never colour alone.
 */
export function ApprovalChain({ steps, className }: {
  steps: { name: string; role?: string; state: "approved" | "rejected" | "waiting" | "skipped";
    at?: string | number | Date; note?: string; avatar?: string | null }[];
  className?: string;
}) {
  const stopIndex = steps.findIndex((s) => s.state === "rejected");
  return (
    <ol data-slot="approval-chain" className={cn("space-y-3", className)}>
      {steps.map((s, i) => {
        const dead = stopIndex >= 0 && i > stopIndex;
        const map = {
          approved: { Icon: Check, word: "Approved", tone: "text-success border-success/40" },
          rejected: { Icon: X, word: "Rejected", tone: "text-destructive border-destructive/40" },
          waiting: { Icon: Clock, word: "Waiting", tone: "text-muted-foreground border-border" },
          skipped: { Icon: Clock, word: "Skipped", tone: "text-muted-foreground border-border" },
        }[dead ? "skipped" : s.state];
        const { Icon, word, tone } = map;
        return (
          <li key={s.name + i} className={cn("flex items-start gap-3", dead && "opacity-50")}>
            <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border", tone)}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AvatarName name={s.name} subtitle={s.role} size="sm" />
                <span className={cn("text-xs", tone.split(" ")[0])}>{word}</span>
                {s.at && <span className="text-xs text-muted-foreground"><TimeAgo date={s.at} /></span>}
              </div>
              {s.note && <p className="mt-0.5 text-sm text-muted-foreground">{s.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

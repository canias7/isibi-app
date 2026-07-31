import { StatusBadge } from "@/components/ui/status-badge";
import { ChevronDown, ChevronUp, Equal } from "lucide-react";
/**
 * How urgent.
 *
 * Carries an ARROW as well as a colour and the word — three levels of red are
 * exactly the case colour alone fails at.
 */
export function PriorityBadge({ level }: { level: "high" | "medium" | "low" }) {
  const cfg = {
    high: { state: "danger" as const, Icon: ChevronUp, label: "High" },
    medium: { state: "warning" as const, Icon: Equal, label: "Medium" },
    low: { state: "quiet" as const, Icon: ChevronDown, label: "Low" },
  }[level];
  return <StatusBadge state={cfg.state}><cfg.Icon className="size-3" />{cfg.label}</StatusBadge>;
}

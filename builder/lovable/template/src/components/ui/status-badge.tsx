import { Badge } from "@/components/ui/badge";
/**
 * A state as a chip. Same monochrome discipline as StatusDot — weight carries
 * the meaning, so it still reads in print and to anyone who cannot see colour.
 */
export function StatusBadge({ state = "neutral", children }: {
  state?: "strong" | "neutral" | "quiet"; children: React.ReactNode;
}) {
  const v = { strong: "default", neutral: "secondary", quiet: "outline" }[state] as "default" | "secondary" | "outline";
  return <Badge variant={v}>{children}</Badge>;
}

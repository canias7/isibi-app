import { cn } from "@/lib/utils";
/**
 * A heading whose LEVEL and SIZE are separate props.
 *
 * They are different questions: level is document structure and screen-reader
 * navigation, size is visual weight. Tying them together is why pages end up
 * jumping h2 to h4 to get smaller text.
 */
export function Heading({ level = 2, size, className, children }: {
  level?: 1 | 2 | 3 | 4; size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string; children?: React.ReactNode;
}) {
  const Tag = ("h" + level) as "h1" | "h2" | "h3" | "h4";
  const s = size ?? (["xl","lg","md","sm"][level - 1] as "xl" | "lg" | "md" | "sm");
  const cls = { xs:"text-sm", sm:"text-base", md:"text-xl", lg:"text-2xl", xl:"text-4xl" }[s];
  return <Tag className={cn("font-semibold tracking-tight text-balance", cls, className)}>{children}</Tag>;
}

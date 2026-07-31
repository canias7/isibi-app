import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Provenance, worn on the content: who this came from.
 *
 * FOUR SOURCES A SMALL-BUSINESS SITE ACTUALLY HAS — the owner, a member, an
 * import, a model — each with a plain-words label. "AI-generated" is a
 * DISCLOSURE, increasingly a required one, and it is distinguished by SHAPE
 * (dashed border) as well as words, because a room of solid chips and one
 * coloured one is the monochrome rule's failure case.
 *
 * WORDS, NEVER AN ICON ALONE. A sparkle glyph is not a disclosure; "robot"
 * iconography reads as decoration. The meaning rides in `title` for hover
 * and in the visible label for everyone.
 *
 * A custom source passes {label, meaning} — the four names are a floor, not
 * a wall.
 */
const KNOWN = {
  owner: { label: "By the shop", meaning: "Written by the people who run this site" },
  member: { label: "Customer content", meaning: "Submitted by a member — their words, not the shop's" },
  imported: { label: "Imported", meaning: "Brought in from another service" },
  ai: { label: "AI-generated", meaning: "Made by a model, reviewed by a person or not — ask the site" },
} as const;

export function SourceLabel({ source, className }: {
  source: keyof typeof KNOWN | { label: string; meaning?: string };
  className?: string;
}) {
  const s = typeof source === "string" ? KNOWN[source] : source;
  const ai = typeof source === "string" && source === "ai";
  if (!s) return null;
  return (
    <span title={s.meaning}
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 text-muted-foreground",
        ai ? "border-dashed border-foreground/60" : "border-border", className)}>
      {s.label}
    </span>
  );
}

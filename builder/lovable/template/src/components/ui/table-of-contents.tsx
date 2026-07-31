import * as React from "react";
import { useScrollSpy, ScrollSpy } from "@/components/ui/scroll-spy";
import { cn } from "@/lib/utils";
/**
 * A table of contents READ FROM THE ARTICLE, not hand-built.
 *
 * IT SCANS THE REAL HEADINGS (h2/h3 inside the ref'd article) — a
 * hand-maintained TOC drifts the first time somebody edits a heading, and
 * the drift is invisible until a reader clicks a link to a section that
 * was renamed. Deriving from the DOM makes the TOC correct by construction.
 *
 * HEADINGS WITHOUT IDS GET ONE, slugified from their text, so the links
 * work on articles that never thought about anchors. An id that already
 * exists on the page is suffixed rather than duplicated — two identical
 * ids means the browser scrolls to the first one, silently, every time.
 *
 * Highlighting and rendering are ScrollSpy's (one implementation of
 * "which section am I in"); this component's job is the derivation.
 */
export function slugifyHeading(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "section";
}

export function TableOfContents({ articleRef, label = "On this page", className }: {
  articleRef: React.RefObject<HTMLElement | null>;
  label?: string;
  className?: string;
}) {
  const [sections, setSections] = React.useState<{ id: string; label: string; depth?: number }[]>([]);

  React.useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const found: { id: string; label: string; depth?: number }[] = [];
    root.querySelectorAll<HTMLElement>("h2, h3").forEach((h) => {
      const text = (h.textContent || "").trim();
      if (!text) return;
      if (!h.id) {
        let id = slugifyHeading(text);
        // A duplicate id scrolls to the FIRST match forever - suffix instead.
        let n = 2;
        while (document.getElementById(id)) id = `${slugifyHeading(text)}-${n++}`;
        h.id = id;
      }
      found.push({ id: h.id, label: text, depth: h.tagName === "H3" ? 1 : 0 });
    });
    setSections(found);
  }, [articleRef]);

  // The sections arrive AFTER the first render (they are read from the DOM),
  // so useScrollSpy's own "first id active" initial state ran on an empty
  // list and stuck at "" - fall back to the first section until the spy
  // has seen a real crossing. Found by driving, not by reading.
  const spied = useScrollSpy(sections.map((s) => s.id));
  const active = spied || sections[0]?.id || "";
  if (!sections.length) return null;
  return <ScrollSpy sections={sections} active={active} label={label} className={cn(className)} />;
}

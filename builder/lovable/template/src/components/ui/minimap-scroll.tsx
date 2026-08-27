import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A shrunk map of a long document, with the viewport marked and draggable.
 *
 * `scroll-progress` IS A BAR — how far through, and nothing about the shape
 * of what is left. `table-of-contents` is headings, which is the structure
 * an author wrote rather than what the page LOOKS like. A minimap answers
 * "where is that big table" and "how much of this is code", which is how
 * people navigate long pages in practice.
 *
 * IT IS `aria-hidden` AND NOT A TAB STOP. It is a shrunk picture of content
 * that is already on the page and already navigable; exposing it doubles
 * every landmark for a screen-reader user and helps nobody. The table of
 * contents is the accessible way to jump, and this sits beside it.
 *
 * THE SOURCE IS BLOCK RECTANGLES, NOT A SCREENSHOT. Cloning the DOM into a
 * scaled container costs a second layout of the whole document on every
 * resize; measuring the top-level children once and drawing boxes is cheap
 * and reads better at 6% scale, where real text is grey mush anyway.
 *
 * Positions refresh on resize AND on content mutation, because a page that
 * grows after load (images, lazy sections) otherwise keeps a map of a
 * document that no longer exists.
 */
export function MinimapScroll({ targetRef, width = 56, className }: {
  targetRef: React.RefObject<HTMLElement | null>;
  width?: number;
  className?: string;
}) {
  const [blocks, setBlocks] = React.useState<{ top: number; height: number; solid: boolean }[]>([]);
  const [docH, setDocH] = React.useState(1);
  const [view, setView] = React.useState({ top: 0, height: 0 });

  React.useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const measure = () => {
      const base = el.getBoundingClientRect().top + window.scrollY;
      const kids = Array.from(el.children) as HTMLElement[];
      setBlocks(kids.map((k) => {
        const r = k.getBoundingClientRect();
        return {
          top: r.top + window.scrollY - base,
          height: r.height,
          // Big blocks read as landmarks; short ones as text.
          solid: r.height > 120,
        };
      }));
      setDocH(Math.max(1, el.scrollHeight));
    };
    const onScroll = () => {
      const base = el.getBoundingClientRect().top + window.scrollY;
      setView({ top: window.scrollY - base, height: window.innerHeight });
    };
    measure(); onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    // A page that grows after load must not keep a map of the old one.
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(measure) : null;
    mo?.observe(el, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      mo?.disconnect();
    };
  }, [targetRef]);

  const scale = 1 / docH;
  const jump = (clientY: number, box: DOMRect) => {
    const el = targetRef.current;
    if (!el) return;
    const base = el.getBoundingClientRect().top + window.scrollY;
    const frac = (clientY - box.top) / box.height;
    window.scrollTo({ top: base + frac * docH - window.innerHeight / 2 });
  };

  return (
    <div data-slot="minimap-scroll" aria-hidden onMouseDown={(e) => jump(e.clientY, e.currentTarget.getBoundingClientRect())}
      onMouseMove={(e) => { if (e.buttons === 1) jump(e.clientY, e.currentTarget.getBoundingClientRect()); }}
      style={{ width, height: "60vh" }}
      className={cn("relative shrink-0 cursor-pointer overflow-hidden rounded border border-border bg-muted/30", className)}>
      {blocks.map((b, i) => (
        <span key={i} className={cn("absolute start-1 end-1 rounded-[1px]", b.solid ? "bg-foreground/35" : "bg-foreground/15")}
          style={{ top: `${b.top * scale * 100}%`, height: `${Math.max(0.4, b.height * scale * 100)}%` }} />
      ))}
      <span className="absolute inset-x-0 border-y border-foreground bg-foreground/10"
        style={{ top: `${Math.max(0, view.top * scale * 100)}%`, height: `${Math.min(100, view.height * scale * 100)}%` }} />
    </div>
  );
}

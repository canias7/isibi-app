import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A table of contents that highlights the section you are reading.
 *
 * IT PICKS THE TOPMOST SECTION IN VIEW, not simply the last one to intersect.
 * Scrolling upwards fires the entries in the opposite order, so a naive handler
 * highlights whichever fired most recently and the marker jumps to the wrong
 * heading every time somebody scrolls back — the classic scroll-spy bug.
 *
 * The `rootMargin` puts the detection line near the TOP of the viewport, so the
 * highlighted section is the one being read rather than one about to arrive at
 * the bottom.
 *
 * Clicking a link scrolls SMOOTHLY and moves focus to the section, which is
 * what makes the table of contents work with a keyboard: without the focus
 * move, the next Tab goes back to the link after the one just clicked.
 *
 * The last section is often too short to reach the detection line, so the
 * bottom of the page force-selects it — otherwise the final entry can never
 * highlight, which looks like a broken control on every long page.
 */
export function useScrollSpy(ids: string[], offset = "-20% 0px -70% 0px") {
  const [active, setActive] = React.useState(ids[0] ?? "");

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      // Topmost in view, in document order — not the most recent to fire.
      const first = ids.find((id) => seen.get(id));
      if (first) setActive(first);
    }, { rootMargin: offset });

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    const onScroll = () => {
      // The last section is usually too short to reach the line.
      if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 4) {
        setActive(ids[ids.length - 1] ?? "");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [ids, offset]);

  return active;
}

export function ScrollSpy({ sections, active, label = "On this page", className }: {
  sections: { id: string; label: React.ReactNode; depth?: number }[];
  active: string;
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("text-sm", className)}>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <ul className="flex flex-col">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={s.id === active ? "true" : undefined}
              onClick={(e) => {
                const el = document.getElementById(s.id);
                if (!el) return;
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                // Move focus, or the next Tab continues from the link.
                el.setAttribute("tabindex", "-1");
                el.focus({ preventScroll: true });
                history.replaceState(null, "", `#${s.id}`);
              }}
              style={{ paddingLeft: `${0.5 + (s.depth ?? 0) * 0.75}rem` }}
              className={cn("block border-l-2 py-1 text-sm",
                s.id === active
                  ? "border-foreground font-medium"
                  : "border-border text-muted-foreground hover:text-foreground")}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

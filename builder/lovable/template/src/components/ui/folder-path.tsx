import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Where you are in the folders — root and current always visible.
 *
 * MIDDLE SEGMENTS COLLAPSE FIRST (the breadcrumb-collapse rule): the
 * root anchors "which world am I in" and the last segment is "where I
 * am" — the middle is the walk between them, and it folds into a "…"
 * button that expands in place rather than a menu (a path is read
 * left-to-right; a dropdown breaks the reading).
 *
 * EVERY SEGMENT IS A JUMP, except the current one, which is text — a
 * link to where you already are teaches people links lie (the permalink
 * discipline). Separators are aria-hidden slashes; the nav is labelled.
 */
export function FolderPath({ segments, onJump, maxVisible = 4, className }: {
  segments: { id: string; name: string }[];
  onJump: (id: string) => void;
  maxVisible?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const collapse = !expanded && segments.length > maxVisible;
  const shown = collapse
    ? [segments[0], null, ...segments.slice(segments.length - (maxVisible - 2))]
    : segments;

  return (
    <nav data-slot="folder-path" aria-label="Folder path" className={cn("flex min-w-0 items-center gap-1 text-sm", className)}>
      {shown.map((seg, i) => {
        if (seg === null) {
          // The separator comes BEFORE the fold and none after - the next
          // segment brings its own, and two slashes read as a typo (seen
          // in a drive: "Media…//July").
          return (
            <React.Fragment key="fold">
              <span aria-hidden className="text-muted-foreground">/</span>
              <button type="button" onClick={() => setExpanded(true)}
                aria-label={`Show ${segments.length - maxVisible} more folders`}
                className="cursor-pointer rounded px-1 text-muted-foreground hover:bg-muted">
                …
              </button>
            </React.Fragment>
          );
        }
        const last = seg.id === segments[segments.length - 1].id;
        return (
          <React.Fragment key={seg.id}>
            {i > 0 ? <span aria-hidden className="text-muted-foreground">/</span> : null}
            {last ? (
              <span aria-current="location" className="min-w-0 truncate font-medium">{seg.name}</span>
            ) : (
              <button type="button" onClick={() => onJump(seg.id)}
                className="min-w-0 cursor-pointer truncate text-muted-foreground hover:text-foreground hover:underline">
                {seg.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

import * as React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Two lists, for and against.
 *
 * THE COUNTS ARE NOT A VERDICT and the component says so. Five small pros do
 * not beat one large con, and a layout that puts "5" against "1" invites
 * exactly that arithmetic — which is the well-known failure of the pros-and-cons
 * format. `weight` marks the ones that carry more, and the footnote states the
 * rule out loud.
 *
 * `+` AND `−` ARE IN THE MARKUP, not colour. Green and red columns say nothing
 * in greyscale or in print, and this is a block people print and paste into
 * documents more than most.
 *
 * IT DOES NOT PAD to equal length. Three pros and one con is a real shape and
 * balancing the columns with filler is how a decision document starts lying.
 *
 * An empty side says so explicitly — "nothing against" is a finding, and an
 * empty column reads as an unfinished document.
 */
export function ProsCons({ pros, cons, forLabel = "For", againstLabel = "Against", className }: {
  pros: { key: string; text: React.ReactNode; weight?: "high" }[];
  cons: { key: string; text: React.ReactNode; weight?: "high" }[];
  forLabel?: React.ReactNode;
  againstLabel?: React.ReactNode;
  className?: string;
}) {
  const column = (
    title: React.ReactNode,
    items: { key: string; text: React.ReactNode; weight?: "high" }[],
    Icon: typeof Plus,
    sign: string,
    empty: string,
  ) => (
    <section className="min-w-0">
      <h3 className="mb-1.5 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide uppercase">
        {title}
        <span className="font-normal text-muted-foreground tabular-nums">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i.key} className="flex items-start gap-2 text-sm">
              <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="sr-only">{sign}</span>
              <span className={cn("min-w-0", i.weight === "high" && "font-medium")}>
                {i.text}
                {i.weight === "high" ? (
                  <span className="ms-1.5 text-xs font-normal text-muted-foreground">counts for a lot</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div data-slot="pros-cons" className={cn("flex flex-col gap-3", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {column(forLabel, pros, Plus, "For:", "Nothing in favour.")}
        {column(againstLabel, cons, Minus, "Against:", "Nothing against.")}
      </div>
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">
        The counts are not the answer &mdash; one heavy point can outweigh five light ones.
      </p>
    </div>
  );
}

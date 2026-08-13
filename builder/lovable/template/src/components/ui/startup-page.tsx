import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Where the app opens: where you left off, a fixed page, or home.
 *
 * "WHERE I LEFT OFF" IS FIRST AND DEFAULT — it is what most people mean by
 * "just open normally", and it needs no further choice. The fixed-page
 * option carries its select INSIDE the option row; picking a page selects
 * the radio (choosing a destination IS choosing that mode — making someone
 * click the radio first and the dropdown second is a two-step for one
 * decision).
 *
 * The select stays operable in every mode for that reason — while unchosen
 * it shows "choose…" in muted ink so the row cannot read as already set.
 */
export function StartupPage({ pages, value, onChange, className }: {
  pages: { key: string; label: string }[];
  value: { mode: "resume" | "home" | "page"; page?: string };
  onChange: (v: { mode: "resume" | "home" | "page"; page?: string }) => void;
  className?: string;
}) {
  const name = React.useId();
  const row = "flex cursor-pointer items-center gap-2 text-sm";
  const radio = "size-3.5 cursor-pointer accent-foreground";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className={row}>
        <input type="radio" name={name} className={radio}
          checked={value.mode === "resume"} onChange={() => onChange({ mode: "resume" })} />
        Where I left off
      </label>
      <label className={row}>
        <input type="radio" name={name} className={radio}
          checked={value.mode === "home"} onChange={() => onChange({ mode: "home" })} />
        The home page
      </label>
      <label className={row}>
        <input type="radio" name={name} className={radio}
          checked={value.mode === "page"} onChange={() => onChange({ mode: "page", page: value.page ?? pages[0]?.key })} />
        <span>Always this page:</span>
        <select aria-label="Page to open"
          value={value.mode === "page" ? value.page : ""}
          onChange={(e) => onChange({ mode: "page", page: e.target.value })}
          className={cn("h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value.mode !== "page" && "text-muted-foreground")}>
          {value.mode !== "page" ? <option value="">choose…</option> : null}
          {pages.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
    </div>
  );
}

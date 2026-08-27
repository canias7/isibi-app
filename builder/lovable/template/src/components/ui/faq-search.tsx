import * as React from "react";
import { SearchInput } from "@/components/ui/search-input";
import { Faq, type QA } from "@/components/ui/faq";
import { ResultCount } from "@/components/ui/result-count";
import { cn } from "@/lib/utils";
/**
 * Questions with a filter over them.
 *
 * Filters in memory rather than asking the server: an FAQ is a few dozen items
 * and a round trip per keystroke is the wrong shape entirely.
 */
export function FaqSearch({ items, placeholder = "Search questions…", className }: {
  items: QA[]; placeholder?: string; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? items.filter((x) => (x.question + " " + x.answer).toLowerCase().includes(needle))
    : items;
  return (
    <div data-slot="faq-search" className={cn("flex flex-col gap-3", className)}>
      <SearchInput value={q} onChange={setQ} placeholder={placeholder} />
      {needle && <ResultCount total={shown.length} noun="question" filtered />}
      <Faq items={shown} />
    </div>
  );
}

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn, labelText } from "@/lib/utils";
/**
 * People against candidate slots — who can make which.
 *
 * `availability-grid` SHOWS ONE PERSON'S FREE TIME. This is the other
 * question: given six people and four possible times, which time loses the
 * fewest. Nothing in the kit crosses respondents with options.
 *
 * THE TALLY NAMES WHO CANNOT MAKE IT, not just a count. "4 of 6" tells an
 * organiser nothing actionable; "4 of 6 — not Ada, not Grace" is the whole
 * decision, because one of those people may not matter and one may be the
 * client.
 *
 * A BLANK IS "NO ANSWER", DRAWN DIFFERENTLY FROM "NO". The decision-matrix
 * rule: treating silence as refusal picks the wrong slot, and treating it as
 * agreement picks a worse one.
 *
 * The winning column is marked by weight and a word, and ties are declared
 * as ties rather than resolved by array order (the winner-badge rule).
 */
export type PollVote = "yes" | "no" | "maybe";

export function MeetingPollGrid({ people, slots, votes, onVote, className }: {
  people: { key: string; label: string }[];
  slots: { key: string; label: React.ReactNode }[];
  /** `${personKey}:${slotKey}` -> vote; absent means no answer yet. */
  votes: Record<string, PollVote>;
  onVote?: (person: string, slot: string, vote: PollVote) => void;
  className?: string;
}) {
  const yesFor = (s: string) => people.filter((p) => votes[`${p.key}:${s}`] === "yes");
  const noFor = (s: string) => people.filter((p) => votes[`${p.key}:${s}`] === "no");
  const best = Math.max(0, ...slots.map((s) => yesFor(s.key).length));
  const winners = slots.filter((s) => yesFor(s.key).length === best && best > 0);

  const cycle: Record<string, PollVote> = { yes: "no", no: "maybe", maybe: "yes" };

  return (
    <div data-slot="meeting-poll-grid" className={cn("flex flex-col gap-2", className)}>
      <table className="text-xs">
        <thead>
          <tr>
            <td />
            {slots.map((s) => {
              const isWin = winners.length === 1 && winners[0].key === s.key;
              return (
                <th key={s.key} scope="col" className={cn("px-1.5 pb-1", isWin && "font-bold")}>
                  {s.label}
                  {isWin ? <span className="block text-[10px] font-medium">best</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.key}>
              <th scope="row" className="pe-2 text-end font-normal">{p.label}</th>
              {slots.map((s) => {
                const key = `${p.key}:${s.key}`;
                const v = votes[key];
                return (
                  <td key={s.key} className="p-0.5 text-center">
                    <button type="button" disabled={!onVote}
                      onClick={() => onVote?.(p.key, s.key, cycle[v ?? "maybe"])}
                      aria-label={`${labelText(p.label)} for ${labelText(s.label)}: ${v ?? "no answer"}`}
                      className={cn("flex size-7 items-center justify-center rounded border",
                        v === "yes" ? "border-foreground bg-foreground text-background"
                        : v === "no" ? "border-foreground"
                        : v === "maybe" ? "border-border bg-muted"
                        : "border-dashed border-border",
                        onVote && "cursor-pointer")}>
                      {v === "yes" ? <Check className="size-3.5" aria-hidden />
                       : v === "no" ? <Minus className="size-3.5" aria-hidden />
                       : v === "maybe" ? <span aria-hidden className="text-[10px]">?</span>
                       : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="pe-2 pt-1 text-end font-medium">Can make it</th>
            {slots.map((s) => (
              <td key={s.key} className="px-1 pt-1 text-center text-[11px] font-medium tabular-nums">
                {yesFor(s.key).length}/{people.length}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {/* Names, not a count - one absentee may not matter and one may be the client. */}
      <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        {slots.map((s) => {
          const out = noFor(s.key);
          const quiet = people.filter((p) => !votes[`${p.key}:${s.key}`]);
          return (
            <li key={s.key}>
              <b className="text-foreground">{s.label}</b>
              {out.length ? <> — not {out.map((p) => p.label).join(", ")}</> : <> — everyone who answered can make it</>}
              {quiet.length ? <> · no answer from {quiet.map((p) => p.label).join(", ")}</> : null}
            </li>
          );
        })}
      </ul>
      {winners.length > 1 ? (
        <p className="text-[11px] font-medium">Tied: {winners.map((w) => labelText(w.label)).join(" and ")}.</p>
      ) : null}
    </div>
  );
}

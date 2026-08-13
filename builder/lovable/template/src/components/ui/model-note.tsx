import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * Which system produced this, in the smallest honest amount of space.
 *
 * A SINGLE LINE, NOT A PANEL. The provenance of a generated answer matters
 * enough to record and almost never enough to compete with the answer itself —
 * so it is one muted line of text under the content, the way a photo credit
 * sits under a photograph.
 *
 * THE DATE IS THE FIELD PEOPLE ACTUALLY NEED. A model name is opaque to nearly
 * everyone; "knowledge to March 2026" is immediately usable, and it is the fact
 * that explains why an answer about last week is wrong.
 *
 * `<time dateTime>` on the generation timestamp, so a machine can read the date
 * a human is reading as "3 August".
 *
 * Every field is optional and an empty component renders nothing, because a
 * provenance line assembled from nothing is a stray bullet separator.
 */
export function ModelNote({ model, version, knowledgeTo, generatedAt, className }: {
  model?: string;
  version?: string;
  /** Free text — "March 2026". */
  knowledgeTo?: string;
  /** ISO date-time of this generation. */
  generatedAt?: string;
  className?: string;
}) {
  const parts: React.ReactNode[] = [];
  if (model) parts.push(<span key="m">{model}{version ? ` ${version}` : ""}</span>);
  if (knowledgeTo) parts.push(<span key="k">knowledge to {knowledgeTo}</span>);
  if (generatedAt) {
    const d = toDate(generatedAt);
    const ok = !Number.isNaN(d.getTime());
    parts.push(
      <time key="g" dateTime={isoAttr(generatedAt)}>
        {ok ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : generatedAt}
      </time>,
    );
  }
  if (!parts.length) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {p}
        </span>
      ))}
    </p>
  );
}

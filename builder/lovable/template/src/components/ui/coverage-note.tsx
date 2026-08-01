import { cn } from "@/lib/utils";
/**
 * What coverage is actually like at an address.
 *
 * INDOORS AND OUTDOORS ARE SEPARATE ANSWERS, and it is the difference people
 * complain about. Coverage maps are modelled outdoors; the customer stands in a
 * kitchen with foil-backed insulation and gets nothing, having been told there is
 * full signal. Two figures, honestly labelled, prevent that entire conversation.
 *
 * IT SAYS WHETHER THE FIGURE IS PREDICTED OR MEASURED. A model is a guess with a
 * confidence interval and a survey is not, and presenting both in the same
 * typeface is how "we checked" comes to mean nothing.
 *
 * CALLING OVER WI-FI IS OFFERED WHERE COVERAGE IS POOR, because it is the actual
 * answer for most indoor problems and it is almost never mentioned on the page
 * where the problem is displayed.
 *
 * NO MAP AND NO BARS. A map needs a tile provider and a key, and bars are an
 * undefined scale — words carry this better and read aloud correctly.
 */
export function CoverageNote({ address, outdoors, indoors, measured, wifiCallingAvailable, technology, className }: {
  address?: string;
  outdoors?: "good" | "patchy" | "none";
  /** The one people complain about. */
  indoors?: "good" | "patchy" | "none";
  /** Predicted or actually surveyed. Not the same claim. */
  measured?: boolean;
  wifiCallingAvailable?: boolean;
  /** "4G", "5G", "fibre to the premises". */
  technology?: string;
  className?: string;
}) {
  const say = (v?: "good" | "patchy" | "none") =>
    v === "good" ? "good" : v === "patchy" ? "patchy" : v === "none" ? "nothing usable" : "not known";
  const poorIndoors = indoors === "patchy" || indoors === "none";
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {address && <p className="font-medium">{address}</p>}
      <p>
        Outdoors: {say(outdoors)}. Indoors: <span className={cn(poorIndoors && "font-medium")}>{say(indoors)}</span>.
      </p>
      <p className="text-xs text-muted-foreground">
        {measured
          ? "Measured at this address, not modelled."
          : "Predicted from a model, and models are optimistic indoors. Thick walls and modern insulation both block signal."}
        {technology ? ` ${technology}.` : ""}
      </p>
      {poorIndoors && (
        <p className="text-xs font-medium">
          {wifiCallingAvailable
            ? "Turn on calling over Wi-Fi. It is the real fix for poor indoor signal and costs nothing."
            : "Calling over Wi-Fi is not available on this plan, which is the usual answer to poor indoor signal."}
        </p>
      )}
    </div>
  );
}

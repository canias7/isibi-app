import { cn } from "@/lib/utils";
/**
 * Which dishes contain what — with "we do not know" as a real answer.
 *
 * ABSENT AND ABSENT-BUT-UNCHECKED ARE DIFFERENT, AND THE DIFFERENCE CAN KILL
 * SOMEBODY. A blank cell in an allergen chart is read as "does not contain",
 * and it usually means nobody has checked that supplier's ingredient list. Three
 * states, not two, is the entire reason this exists.
 *
 * CROSS-CONTAMINATION IS ITS OWN STATE. A kitchen that does not put nuts in a
 * dish but fries it in shared oil is not serving a nut-free dish, and a tick-box
 * chart cannot say that at all.
 *
 * IT IS A TABLE WITH REAL HEADERS, so a screen reader announces which allergen
 * a cell belongs to. A grid of icons is unusable to the people most likely to be
 * checking it carefully.
 *
 * NO CLAIM OF SAFETY IS MADE ANYWHERE. The component reports what it was told
 * and says who to ask; a chart that says "safe" is making a promise the data
 * cannot support.
 */
export type Dish = {
  id: string;
  name: string;
  /** Per allergen: "yes" · "no" · "may" (shared equipment) · "unknown". */
  contains: Record<string, "yes" | "no" | "may" | "unknown">;
};

export function AllergenMatrix({ allergens, dishes, askFor, className }: {
  allergens: string[];
  dishes: Dish[];
  /** Who to ask. There is always somebody. */
  askFor?: string;
  className?: string;
}) {
  const unknowns = dishes.reduce(
    (n, d) => n + allergens.filter((a) => (d.contains[a] ?? "unknown") === "unknown").length,
    0,
  );
  const mark = (v: "yes" | "no" | "may" | "unknown") =>
    v === "yes" ? "Yes" : v === "no" ? "No" : v === "may" ? "May" : "?";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                Dish
              </th>
              {allergens.map((a) => (
                <th key={a} scope="col" className="px-2 py-1.5 text-left text-xs font-medium">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dishes.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                  {d.name}
                </th>
                {allergens.map((a) => {
                  const v = d.contains[a] ?? "unknown";
                  return (
                    <td
                      key={a}
                      className={cn(
                        "px-2 py-1.5 text-xs",
                        v === "no" ? "text-muted-foreground" : "font-medium",
                      )}
                    >
                      {mark(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Yes contains it · May means shared equipment · No means checked and absent ·{" "}
        <span className="font-medium text-foreground">? means nobody has checked</span>, which is not the same as no.
      </p>
      {unknowns > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {unknowns} {unknowns === 1 ? "cell has" : "cells have"} not been checked.
          {askFor ? ` Ask ${askFor} before serving anybody who has told you about an allergy.` : ""}
        </p>
      )}
    </div>
  );
}

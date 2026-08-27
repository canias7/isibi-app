import { cn } from "@/lib/utils";
/**
 * Scaling a recipe — with the ingredients that do not scale linearly flagged.
 *
 * SALT, RAISING AGENTS, SPICE AND YEAST DO NOT SCALE WITH THE BATCH, and a
 * component that multiplies everything by the same factor is the reason a
 * tripled cake is inedible. The caller marks which ingredients are non-linear
 * and the component refuses to silently multiply them.
 *
 * TIMES AND TEMPERATURES ARE NOT SCALED AT ALL. A double batch does not take
 * twice as long; it takes longer by an amount no arithmetic here can know, and
 * producing a number would be worse than saying so.
 *
 * IT SCALES BY BATCH SIZE, NOT BY A MULTIPLIER. A baker thinks "I need 60 rolls",
 * not "×2.5", and doing that division in your head at five in the morning is
 * exactly where the mistake goes in.
 *
 * QUANTITIES ARE ROUNDED TO SOMETHING WEIGHABLE. 3.7333 g of yeast is a number
 * no scale in any kitchen can hit, and printing it makes the whole sheet look
 * untrustworthy.
 */
export type Ingredient = {
  id: string;
  what: string;
  quantity: number;
  unit?: string;
  /** Salt, yeast, raising agents, strong spice. */
  scalesNonLinearly?: boolean;
};

export function RecipeScale({ ingredients, baseYield, wantYield, yieldUnit = "portions", timeNote, className }: {
  ingredients: Ingredient[];
  baseYield: number;
  wantYield: number;
  yieldUnit?: string;
  timeNote?: string;
  className?: string;
}) {
  const factor = baseYield > 0 ? wantYield / baseYield : 1;
  // Rounded to something a kitchen scale can actually hit — under 10 to a tenth,
  // under 100 to a whole, above that to fives.
  const weighable = (v: number) => {
    if (v < 10) return Math.round(v * 10) / 10;
    if (v < 100) return Math.round(v);
    return Math.round(v / 5) * 5;
  };
  const nonLinear = ingredients.filter((i) => i.scalesNonLinearly);
  return (
    <div data-slot="recipe-scale" className={cn("space-y-1.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">
          {wantYield} {yieldUnit}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · recipe makes {baseYield}, so ×{Math.round(factor * 100) / 100}
        </span>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {ingredients.map((i) => (
          <li key={i.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {i.what}
              {i.scalesNonLinearly && (
                <span className="block text-xs">Does not scale straight — taste and adjust.</span>
              )}
            </span>
            <span className={cn("shrink-0 tabular-nums", i.scalesNonLinearly && "text-muted-foreground")}>
              {i.scalesNonLinearly
                ? `about ${weighable(i.quantity * factor)}${i.unit ? ` ${i.unit}` : ""}`
                : `${weighable(i.quantity * factor)}${i.unit ? ` ${i.unit}` : ""}`}
            </span>
          </li>
        ))}
      </ul>
      {nonLinear.length > 0 && (
        <p className="text-xs font-medium">
          {nonLinear.length} {nonLinear.length === 1 ? "ingredient does" : "ingredients do"} not scale with the batch.
          The multiplied figure is a starting point, not a quantity.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Times and temperatures are unchanged above — a bigger batch takes longer by an amount no arithmetic can work
        out.{timeNote ? ` ${timeNote}` : ""}
      </p>
    </div>
  );
}

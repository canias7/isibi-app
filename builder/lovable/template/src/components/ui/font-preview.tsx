import { cn } from "@/lib/utils";
/**
 * A typeface shown at the sizes it will actually be used at.
 *
 * SMALL TEXT IS WHERE A FONT FAILS AND WHERE NOBODY LOOKS. A specimen at 48px
 * makes every typeface look competent; the 12px line is where thin strokes
 * disappear and where most of a product's words live. Both are shown, and the
 * small one is not optional.
 *
 * THE AMBIGUOUS CHARACTERS ARE PRINTED TOGETHER — Il1|, O0. In a reference
 * code, a licence plate or an API key those are the difference between working
 * and not, and a font that cannot distinguish them is unusable for anything a
 * person has to retype.
 *
 * NUMBERS ARE SHOWN AS A COLUMN, so proportional digits are obvious. A font
 * whose digits vary in width makes every table of figures unreadable, and it is
 * invisible in a single line of sample text.
 *
 * NO FONT IS LOADED HERE. The caller applies the family; this component only
 * shows what to look at, so it cannot pull in a remote stylesheet.
 */
export function FontPreview({ family, name, sizes = [12, 14, 16, 24], sample = "The quick brown fox jumps over the lazy dog", className }: {
  /** CSS font-family value. */
  family: string;
  name?: string;
  sizes?: number[];
  sample?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} style={{ fontFamily: family }}>
      {name && <p className="text-xs text-muted-foreground" style={{ fontFamily: "inherit" }}>{name}</p>}
      <div className="space-y-1">
        {sizes.map((s) => (
          <p key={s} style={{ fontSize: s }} className="truncate">
            <span className="text-muted-foreground" style={{ fontSize: 11 }}>{s}px </span>
            {sample}
          </p>
        ))}
      </div>
      <div className="grid gap-1 text-sm sm:grid-cols-2">
        <p>
          <span className="block text-xs text-muted-foreground">Easily confused</span>
          Il1| O0 rn m
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Digits</span>
          <span className="block tabular-nums">1234567890</span>
          <span className="block">1111 · 0000</span>
        </p>
      </div>
    </div>
  );
}

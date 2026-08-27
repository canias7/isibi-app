import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * How many rows a page shows.
 *
 * CHANGING IT RETURNS TO PAGE ONE, and that is the behaviour rather than a
 * caller's responsibility — going from 20 per page on page 9 to 100 per page
 * lands on a page that does not exist, and most implementations show an empty
 * table there. `onChange` hands back the size alone precisely so the caller
 * cannot forget: there is no page to preserve.
 *
 * NO "ALL" OPTION. It is the one everybody asks for and it is a request to
 * render an unbounded number of rows — fine on the test data, a frozen tab on
 * the real thing. The largest option is a number, so the cost is at least
 * knowable.
 *
 * A NATIVE `<select>`, because on a phone this becomes the platform's own
 * picker, and four numeric options do not justify a custom listbox.
 *
 * The label is visible, not a placeholder: "20" alone in a corner is a mystery
 * number, and `sr-only` labelling leaves sighted users with the same mystery.
 */
export function PageSize({ value, onChange, options = [10, 20, 50, 100], label = "Per page", id, className }: {
  value: number;
  onChange: (size: number) => void;
  options?: number[];
  label?: string;
  id?: string;
  className?: string;
}) {
  const selectId = id ?? "page-size";
  return (
    <span data-slot="page-size" className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <label htmlFor={selectId} className="text-muted-foreground">{label}</label>
      <NativeSelect id={selectId} value={String(value)} className="h-8 w-auto text-sm"
        onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </NativeSelect>
    </span>
  );
}

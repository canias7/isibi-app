import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
/** A percentage, kept between 0 and 100. */
export function PercentInput({ value, onChange, id, className }: {
  value: string; onChange: (v: string) => void; id?: string; className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupInput id={id} inputMode="decimal" value={value} placeholder="0" className="tabular-nums"
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange("");
          if (!/^\d*[.,]?\d*$/.test(v)) return;
          const n = Number(v.replace(",", "."));
          onChange(Number.isFinite(n) && n > 100 ? "100" : v);
        }} />
      <InputGroupAddon align="inline-end"><span className="text-sm text-muted-foreground">%</span></InputGroupAddon>
    </InputGroup>
  );
}

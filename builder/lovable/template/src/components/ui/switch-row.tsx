import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/** A setting: what it does on the left, the switch on the right. */
export function SwitchRow({ label, description, checked, onChange, id, className }: {
  label: string; description?: string; checked: boolean;
  onChange: (v: boolean) => void; id?: string; className?: string;
}) {
  const rid = id ?? "sw-" + label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", className)}>
      <div className="grid gap-0.5">
        <Label htmlFor={rid}>{label}</Label>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </div>
      <Switch id={rid} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

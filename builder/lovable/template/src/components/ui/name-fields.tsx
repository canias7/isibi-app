import { Input } from "@/components/ui/input";
import { FormRow } from "@/components/ui/form-row";
import { cn } from "@/lib/utils";
/**
 * First and last name, or one field.
 *
 * `single` is the default deliberately: splitting a name assumes a shape many
 * people's names do not have, and most forms only ever join the two back
 * together anyway.
 */
export function NameFields({ single = true, value, onChange, className }: {
  single?: boolean;
  value: { first?: string; last?: string; full?: string };
  onChange: (next: { first?: string; last?: string; full?: string }) => void;
  className?: string;
}) {
  if (single) {
    return (
      <FormRow label="Your name" className={className}>
        <Input autoComplete="name" value={value.full ?? ""}
          onChange={(e) => onChange({ ...value, full: e.target.value })} />
      </FormRow>
    );
  }
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <FormRow label="First name">
        <Input autoComplete="given-name" value={value.first ?? ""}
          onChange={(e) => onChange({ ...value, first: e.target.value })} />
      </FormRow>
      <FormRow label="Last name">
        <Input autoComplete="family-name" value={value.last ?? ""}
          onChange={(e) => onChange({ ...value, last: e.target.value })} />
      </FormRow>
    </div>
  );
}

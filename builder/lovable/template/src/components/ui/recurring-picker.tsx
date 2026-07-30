import { RadioCards } from "@/components/ui/radio-cards";
/** How often it repeats. A closed set, because "every 3rd Tuesday" is a rabbit hole. */
export function RecurringPicker({ value, onChange, className }: {
  value?: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <RadioCards className={className} value={value} onChange={onChange} columns={2}
      options={[
        { value: "once", label: "Just once" },
        { value: "weekly", label: "Every week" },
        { value: "fortnightly", label: "Every 2 weeks" },
        { value: "monthly", label: "Every month" },
      ]} />
  );
}

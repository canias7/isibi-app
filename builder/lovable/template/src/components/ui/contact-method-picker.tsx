import { cn } from "@/lib/utils";
/**
 * How somebody wants to be reached, from the channels a business really uses.
 *
 * IT ONLY OFFERS WHAT THE BUSINESS ACTUALLY ANSWERS. A picker listing WhatsApp
 * on a shop that never opens it produces a customer waiting for a reply that
 * will not come — worse than not offering the choice. Unavailable channels are
 * shown disabled with the reason rather than hidden, so nobody hunts for one.
 *
 * EACH CHANNEL SAYS HOW FAST IT IS. That is what people actually choose on —
 * "usually within an hour" versus "next working day" decides it, and a row of
 * bare channel names makes somebody pick by habit and then be disappointed.
 *
 * MULTIPLE CAN BE CHOSEN when `multi` is set, because "text me AND email me" is
 * a real preference for anything time-sensitive, and forcing one channel is how
 * an appointment reminder gets missed.
 *
 * REAL CHECKBOXES OR RADIOS by mode, with a `<legend>` — not a row of toggle
 * buttons, which announce as unrelated controls and lose the "one of four".
 */
export type ContactMethod = {
  id: string;
  label: string;
  /** "usually within an hour". */
  speed?: string;
  disabled?: boolean;
  reason?: string;
};

export function ContactMethodPicker({ methods, value, onChange, multi, legend = "How should we get in touch?", name = "contact-method", className }: {
  methods: ContactMethod[];
  value: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
  legend?: string;
  name?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {methods.map((m) => (
        <label key={m.id}
          className={cn("flex items-start gap-2.5 text-sm", m.disabled ? "opacity-60" : "cursor-pointer")}>
          <input type={multi ? "checkbox" : "radio"} name={name} value={m.id} disabled={m.disabled}
            checked={value.includes(m.id)} className="mt-0.5 size-4 accent-foreground"
            onChange={(e) => {
              if (!multi) { onChange([m.id]); return; }
              onChange(e.target.checked ? [...value, m.id] : value.filter((x) => x !== m.id));
            }} />
          <span className="min-w-0">
            <span className="block">{m.label}</span>
            {(m.speed || m.reason) && (
              <span className="block text-xs text-muted-foreground">
                {m.disabled ? (m.reason ?? "Not available") : m.speed}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

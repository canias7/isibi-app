import { AvatarName } from "@/components/ui/avatar-name";
import { Phone } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * Who is covering right now, and until when.
 *
 * "Until when" is not optional detail: an on-call panel showing a name and
 * nothing else gives no way to tell whether it is current or a stale row
 * from last week's rota — and the moment somebody doubts it, they ring
 * everybody.
 *
 * The number is a `tel:` link, because this is read on a phone by somebody
 * who needs to call it in the next thirty seconds.
 */
export function OnCall({ name, role, phone, until, avatar, empty = "Nobody is on call.", className }: {
  name?: string | null; role?: string; phone?: string;
  until?: string | number | Date; avatar?: string | null;
  empty?: string; className?: string;
}) {
  if (!name) {
    return <p data-slot="on-call" className={cn("rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm", className)}>{empty}</p>;
  }
  const d = until != null ? toDate(until) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-md border border-border p-3", className)}>
      <AvatarName name={name} subtitle={role} src={avatar} size="md" />
      <div className="ms-auto text-end text-xs text-muted-foreground">
        {ok && <p>Until {d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>}
        {phone && (
          <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}
            className="mt-0.5 inline-flex items-center gap-1 font-medium text-foreground hover:underline">
            <Phone className="size-3.5" />{phone}
          </a>
        )}
      </div>
    </div>
  );
}

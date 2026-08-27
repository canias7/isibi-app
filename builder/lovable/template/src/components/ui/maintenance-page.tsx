import { Wrench } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * The whole site is down on purpose.
 *
 * It gives a time to come back and a way to reach a human — both of them,
 * because "we'll be back soon" with neither is what turns a two-hour window
 * into a day of support calls. The time is formatted in the reader's own
 * timezone.
 */
export function MaintenancePage({ backAt, body, contact, className }: {
  backAt?: string | number | Date; body?: string;
  contact?: { label: string; href: string }; className?: string;
}) {
  const d = backAt != null ? toDate(backAt) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <div data-slot="maintenance-page" className={cn("mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center", className)}>
      <Wrench className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">We're down for maintenance</h1>
      <p className="text-sm text-muted-foreground">
        {body ?? "We're making some changes and will be back shortly."}
      </p>
      {ok && (
        <p className="text-sm">
          Expected back <strong className="font-medium">
            {d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </strong>
        </p>
      )}
      {contact && (
        <p className="text-sm text-muted-foreground">
          Need something urgently? <a href={contact.href} className="underline underline-offset-2">{contact.label}</a>
        </p>
      )}
    </div>
  );
}

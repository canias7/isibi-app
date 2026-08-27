import { cn } from "@/lib/utils";
/**
 * Where data is stored — and, separately, where it can be reached from.
 *
 * STORAGE AND ACCESS ARE DIFFERENT QUESTIONS AND ONLY ONE IS EVER ANSWERED. A
 * product saying "your data stays in the EU" while support staff read it from
 * elsewhere has made a claim that is true and misleading, and access is the
 * half a compliance review asks about.
 *
 * BACKUPS AND SUB-PROCESSORS ARE LISTED SEPARATELY, because they are the usual
 * exceptions — a primary region in one place and backups in another is common,
 * and it is exactly what a residency commitment is supposed to cover.
 *
 * IT SAYS WHETHER THE REGION CAN BE CHANGED. Most cannot be changed after
 * creation, and somebody who assumes otherwise sets up in the wrong place and
 * has to migrate — which this component is next to for a reason.
 *
 * A `<dl>` rather than prose, so each claim is attached to its label and can be
 * quoted line by line into a security questionnaire.
 */
export function DataResidency({ storedIn, accessedFrom = [], backupsIn, subProcessors = [], changeable, className }: {
  /** Where the primary copy lives. */
  storedIn: string;
  /** Places staff or systems can reach it from. */
  accessedFrom?: string[];
  backupsIn?: string;
  /** Third parties that touch it, with where they are. */
  subProcessors?: { name: string; where: string }[];
  changeable?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="data-residency" className={cn("space-y-1", className)}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-muted-foreground">Stored in</dt>
        <dd>{storedIn}</dd>
        {backupsIn && (<><dt className="text-muted-foreground">Backups in</dt><dd>{backupsIn}</dd></>)}
        <dt className="text-muted-foreground">Reachable from</dt>
        <dd>{accessedFrom.length ? accessedFrom.join(", ") : <span className="text-muted-foreground">not stated</span>}</dd>
        {subProcessors.length > 0 && (
          <>
            <dt className="text-muted-foreground">Also touched by</dt>
            <dd>
              {subProcessors.map((s) => (
                <span key={s.name} className="block">{s.name} — {s.where}</span>
              ))}
            </dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">
        {changeable
          ? "This can be changed later."
          : "This is fixed when the workspace is created and cannot be changed afterwards."}
      </p>
    </div>
  );
}

import * as React from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * A clinician: name, register number, and what they actually treat.
 *
 * THE REGISTRATION NUMBER IS THE TRUST SIGNAL, which is why it is set at body
 * weight beside the name rather than hidden in small print. "GMC 4231907" is
 * checkable in thirty seconds by anybody who wants to, and a practitioner who
 * publishes it is telling you they expect to be checked. `registerUrl` makes it
 * one tap. A card with no number renders without one rather than inventing a
 * placeholder, because a made-up credential is a different kind of problem.
 *
 * `treats` IS THE FIELD PATIENTS READ. "Dr Amara Osei, MBBS, MRCGP, DFSRH" says
 * nothing to somebody with a knee that will not bend; "knees, hips, sports
 * injuries" answers their question. Qualifications go in `letters` and stay
 * secondary.
 *
 * NOT TAKING NEW PATIENTS IS STATED, not implied by a missing button. Absence
 * reads as an oversight and sends somebody through a booking form to be turned
 * away at the end, which is the worst place to find out.
 *
 * `languages` is here because it is genuinely load-bearing for a lot of people
 * and is left off almost every practice site in the country.
 */
export function PractitionerCard({
  name, role, letters, register, registerNumber, registerUrl,
  treats, languages, photo, note, accepting = true, action, className,
}: {
  name: string;
  /** "GP Partner", "Practice Nurse", "Osteopath". */
  role?: string | null;
  /** Post-nominals. Secondary to `treats`, deliberately. */
  letters?: string | null;
  /** The register's name: "GMC", "GDC", "NMC", "HCPC". */
  register?: string | null;
  registerNumber?: string | null;
  /** Where to check it. */
  registerUrl?: string | null;
  /** What they treat, in the words a patient would use. */
  treats?: string[];
  languages?: string[];
  photo?: string | null;
  note?: string | null;
  /** False renders "Not taking new patients" in words. */
  accepting?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("flex gap-5", className)}>
      <SafeImage src={photo} alt={name} ratio="1/1" className="w-24 shrink-0 rounded-xl sm:w-28" />
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold tracking-tight">{name}</h3>
        {(role || letters) && (
          <p className="text-sm text-muted-foreground">
            {role}
            {role && letters && " · "}
            {letters}
          </p>
        )}
        {register && registerNumber && (
          <p className="mt-1.5 text-sm">
            {registerUrl
              ? <a href={registerUrl} className="underline underline-offset-4">{register} {registerNumber}</a>
              : <>{register} {registerNumber}</>}
            <span className="text-muted-foreground"> — on the public register</span>
          </p>
        )}
        {treats && treats.length > 0 && (
          <p className="mt-2 text-sm leading-relaxed">
            <span className="text-muted-foreground">Treats </span>{treats.join(", ")}
          </p>
        )}
        {languages && languages.length > 0 && (
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Speaks </span>{languages.join(", ")}
          </p>
        )}
        {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* IN WORDS, at weight — not a green dot and a grey one. */}
          {!accepting && <span className="text-sm font-medium">Not taking new patients</span>}
          {accepting && action}
        </div>
      </div>
    </article>
  );
}

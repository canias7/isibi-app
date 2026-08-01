import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Signing a visitor in — collecting only what an evacuation needs.
 *
 * THE PURPOSE OF THIS RECORD IS A FIRE ROLL CALL, and that is what decides the
 * fields. A name and who they are visiting is enough to account for everybody
 * in a building; a car registration, a company and a signature are collected out
 * of habit and are a data-protection liability with no operational use.
 *
 * THE PREVIOUS VISITOR'S NAME MUST NOT BE ON SCREEN. A paper book shows every
 * caller the last twenty names, and reproducing that in software recreates the
 * exact leak that made paper books non-compliant.
 *
 * THE HOST IS NOTIFIED, and the visitor is told so. A sign-in that silently
 * queues somebody in a lobby is the commonest reason people give up and wander
 * in unaccompanied.
 *
 * SIGNING OUT IS THE HALF THAT MATTERS AND IS THE HALF THAT FAILS. A roll call
 * lists people who left an hour ago, so the component states plainly that
 * signing out is what makes the record true.
 */
export function VisitorSignIn({ visitorName, hostName, onVisitorNameChange, onHostNameChange, hostNotified, evacuationNote, extraFieldsWarning = true, className }: {
  visitorName: string;
  hostName: string;
  onVisitorNameChange: (next: string) => void;
  onHostNameChange: (next: string) => void;
  /** True once the host has been told. */
  hostNotified?: boolean;
  /** Where to assemble. */
  evacuationNote?: string;
  /** Shows the note about not collecting more than needed. */
  extraFieldsWarning?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="space-y-1">
        <label htmlFor={`${id}-v`} className="block text-sm font-medium">Your name</label>
        <Input id={`${id}-v`} value={visitorName} autoComplete="name" onChange={(e) => onVisitorNameChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-h`} className="block text-sm font-medium">Who are you here to see?</label>
        <Input id={`${id}-h`} value={hostName} autoComplete="off" onChange={(e) => onHostNameChange(e.target.value)} />
      </div>
      {hostNotified && <p className="text-xs">We have let them know you are here.</p>}
      {evacuationNote && <p className="text-xs text-muted-foreground">{evacuationNote}</p>}
      <p className="text-xs font-medium">Please sign out when you leave — that is what makes a fire roll call true.</p>
      {extraFieldsWarning && (
        <p className="text-xs text-muted-foreground">
          We ask for two things because that is what accounting for everybody in a fire needs. Nothing else is kept.
        </p>
      )}
    </div>
  );
}

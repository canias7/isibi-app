import * as React from "react";
import { CoachMark } from "@/components/ui/coach-mark";
/**
 * A short guided tour, run through coach-marks.
 *
 * SKIP IS ALWAYS ONE CLICK AND ENDS THE WHOLE TOUR — a tour that must be
 * stepped through is hostage-taking, and the person who skipped is not
 * asked again: completion and skip are both remembered (localStorage) so
 * the tour NEVER auto-replays. Replaying is the caller's explicit call
 * (a "show me around" button), not a page-load ambush.
 *
 * IT ORCHESTRATES, COACH-MARK RENDERS. One implementation of "ring an
 * element and say a thing" (with its rAF anchor tracking) — this is the
 * step state, the memory, and Escape-to-end wired over it.
 *
 * THREE TO FIVE STEPS. More is a manual nobody asked for; the tour prop
 * type does not enforce it, the header says it so the caller has to
 * disagree on purpose.
 */
export function FeatureTour({ steps, storageKey = "feature-tour", open, onClose }: {
  steps: { targetRef: React.RefObject<HTMLElement | null>; title: React.ReactNode; body?: React.ReactNode }[];
  storageKey?: string;
  /** Controlled: pass true to run (e.g. first visit — read the hook), false/undefined otherwise. */
  open: boolean;
  onClose: () => void;
}) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => { if (open) setI(0); }, [open]);

  const finish = React.useCallback(() => {
    try { localStorage.setItem(storageKey, "done"); } catch { /* private mode */ }
    onClose();
  }, [storageKey, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, finish]);

  const step = steps[i];
  if (!open || !step) return null;
  return (
    <CoachMark
      targetRef={step.targetRef}
      open
      step={i + 1}
      total={steps.length}
      title={step.title}
      onNext={i + 1 < steps.length ? () => setI((v) => v + 1) : finish}
      onBack={i > 0 ? () => setI((v) => v - 1) : undefined}
      onSkip={finish}
    >
      {step.body}
    </CoachMark>
  );
}

/** True when this tour has never been completed or skipped on this device. */
export function useTourUnseen(storageKey = "feature-tour") {
  const [unseen, setUnseen] = React.useState(false);
  React.useEffect(() => {
    try { setUnseen(localStorage.getItem(storageKey) !== "done"); } catch { setUnseen(false); }
  }, [storageKey]);
  return unseen;
}

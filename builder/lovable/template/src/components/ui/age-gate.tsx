import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An age gate that stores the VERDICT, never the birthday.
 *
 * THE DATE OF BIRTH DOES NOT GET KEPT. The question is "old enough or not",
 * a boolean, and a stored birthday is identity data collected for a yes/no —
 * sessionStorage holds `1` or `0` and the date dies with the submit. The
 * header of this file is the privacy policy for it.
 *
 * NOTHING IS PRE-FILLED — no values AND no example-date placeholders. A gate
 * whose year already says 1990 is a checkbox with extra steps, and a
 * placeholder of "1990" reads as filled at a glance (seen in render). The
 * DAY/MONTH/YEAR labels carry the format. Three fields with `bday` autocomplete, so a browser can fill the
 * REAL date in one tap, which is honest in the other direction.
 *
 * THE REFUSAL IS NEUTRAL AND UNDECORATED: "this section isn't available."
 * No shame, no countdown to eligibility (which would echo the birthday we
 * just refused to store). The refusal is remembered for the SESSION only —
 * on a shared machine a permanent no locks out every later visitor.
 *
 * Age is computed properly — month and day, not year arithmetic, or everyone
 * is a year older from the 1st of January.
 */
function ageOn(now: Date, y: number, m: number, d: number) {
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

export function AgeGate({ minAge = 18, what = "This section", storageKey = "age-gate", onVerdict, children, className }: {
  minAge?: number;
  what?: string;
  storageKey?: string;
  onVerdict?: (ok: boolean) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const key = `${storageKey}-${minAge}`;
  const [verdict, setVerdict] = React.useState<null | boolean>(null);
  const [d, setD] = React.useState(""); const [m, setM] = React.useState(""); const [y, setY] = React.useState("");

  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved === "1") setVerdict(true);
      if (saved === "0") setVerdict(false);
    } catch { /* private mode */ }
  }, [key]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dd = parseInt(d, 10), mm = parseInt(m, 10), yy = parseInt(y, 10);
    if (!dd || !mm || !yy || yy < 1900 || mm > 12 || dd > 31) return;
    const ok = ageOn(new Date(), yy, mm, dd) >= minAge;
    // The verdict is stored; the date just typed is in three state variables
    // that unmount with the form. Nothing else sees it.
    try { sessionStorage.setItem(key, ok ? "1" : "0"); } catch { /* private mode */ }
    setVerdict(ok);
    onVerdict?.(ok);
  };

  if (verdict === true) return <>{children}</>;
  if (verdict === false) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-6 text-center", className)}>
        <p className="text-sm text-muted-foreground">{what} isn’t available.</p>
      </div>
    );
  }

  const field = "h-9 rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <form onSubmit={submit} className={cn("flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6", className)}>
      <div className="text-center">
        <p className="text-sm font-medium">{what} is for people {minAge} and over</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Enter your date of birth. Only the yes or no is kept — never the date.</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Day
          <input value={d} onChange={(e) => setD(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric" autoComplete="bday-day" className={cn(field, "w-12")} />
        </label>
        <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Month
          <input value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric" autoComplete="bday-month" className={cn(field, "w-12")} />
        </label>
        <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Year
          <input value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" autoComplete="bday-year" className={cn(field, "w-16")} />
        </label>
      </div>
      <button type="submit" disabled={!d || !m || y.length < 4}
        className="cursor-pointer rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
        Continue
      </button>
    </form>
  );
}

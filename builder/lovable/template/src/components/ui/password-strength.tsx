import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * How good a password is, and what would make it better.
 *
 * It scores LENGTH above everything else, because that is what actually decides
 * how long a password survives — and it does NOT require a symbol, a capital
 * and a digit. Composition rules are the reason people write `Password1!`, a
 * string that satisfies every rule and is in the first thousand guesses of any
 * attack. NIST dropped them for exactly that reason.
 *
 * COMMON passwords are refused whatever they score. `Tr0ub4dor&3` looks strong
 * to a character-class checker and is in every wordlist there is; the short
 * embedded list here is a fallback for the obvious ones, and a real site should
 * be checking against a breach corpus — which `site-pwned.mjs` does server-side
 * with k-anonymity.
 *
 * The advice is what is MISSING, not what is present: "add a few more words"
 * tells somebody what to do, while "1 of 4 criteria met" makes them guess.
 *
 * The bar carries a WORD as well as a length. A four-segment bar with no label
 * is a colour scale, which is the one channel this kit never relies on.
 */
const COMMON = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "letmein", "welcome",
  "monkey", "dragon", "iloveyou", "admin", "login", "passw0rd", "football",
  "starwars", "sunshine", "princess", "trustno1", "123456789", "qwertyuiop",
]);

export function scorePassword(pw: string) {
  const s = pw.trim();
  if (!s) return { score: 0, label: "", advice: [] as string[], common: false };
  const common = COMMON.has(s.toLowerCase()) || COMMON.has(s.toLowerCase().replace(/[^a-z]/g, ""));
  const advice: string[] = [];
  let score = 0;
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (s.length >= 16) score++;
  if (/\s/.test(s) || new Set(s).size > 10) score++;
  if (s.length < 12) advice.push("Make it longer — length beats everything else.");
  if (!/\s/.test(s) && s.length < 16) advice.push("A few unrelated words is easier to remember and harder to guess.");
  if (new Set(s).size <= 4) advice.push("Too many repeated characters.");
  if (common) { score = 0; advice.length = 0; advice.push("That is one of the most-guessed passwords there is."); }
  return {
    score: Math.min(4, score),
    label: common ? "Do not use this" : ["Very weak", "Weak", "Fair", "Good", "Strong"][Math.min(4, score)],
    advice,
    common,
  };
}

export function PasswordStrength({ value, className }: { value: string; className?: string }) {
  const { score, label, advice } = scorePassword(value);
  if (!value) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-1 flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("flex-1 rounded-full", i < score ? "bg-foreground" : "bg-muted")} />
          ))}
        </div>
        <span className="w-24 shrink-0 text-right text-xs font-medium">{label}</span>
      </div>
      <p aria-live="polite" className="sr-only">Password strength: {label}.</p>
      {advice.length ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {advice.map((a) => <li key={a}>{a}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

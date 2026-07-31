/** Initials from a name, for where an avatar is overkill. */
export function Initials({ name, max = 2, className }: {
  name: string; max?: number; className?: string;
}) {
  const text = name.trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, max).join("").toUpperCase();
  return <span className={className} aria-hidden="true">{text || "?"}</span>;
}

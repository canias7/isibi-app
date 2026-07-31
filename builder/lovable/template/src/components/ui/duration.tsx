/** Minutes as something readable: 90 becomes "1 hr 30 min". */
export function Duration({ minutes, className }: { minutes: number; className?: string }) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60), rest = m % 60;
  const text = h === 0 ? `${rest} min` : rest === 0 ? `${h} hr` : `${h} hr ${rest} min`;
  return <span className={className}>{text}</span>;
}

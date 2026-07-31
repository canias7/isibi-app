/** Deliberate empty space, where a gap cannot reach. */
export function Spacer({ size = 8 }: { size?: 2 | 4 | 6 | 8 | 12 | 16 | 24 }) {
  const h: Record<number, string> = { 2:"h-2",4:"h-4",6:"h-6",8:"h-8",12:"h-12",16:"h-16",24:"h-24" };
  return <div className={h[size]} aria-hidden="true" />;
}

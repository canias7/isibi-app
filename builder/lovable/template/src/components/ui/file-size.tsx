/** Bytes as something human. 1024-based, matching what an OS reports. */
export function FileSize({ bytes, className }: { bytes: number; className?: string }) {
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return <span data-slot="file-size" className={className ? className + " tabular-nums" : "tabular-nums"}>
    {i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)} {units[i]}
  </span>;
}

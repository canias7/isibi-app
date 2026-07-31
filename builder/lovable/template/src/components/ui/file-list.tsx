import { FileRow } from "@/components/ui/file-row";
import { cn } from "@/lib/utils";
/** Several files, with an honest empty state. */
export function FileList({ files, onRemove, empty = "No files yet", className }: {
  files: { name: string; size?: number; href?: string; meta?: string | null }[];
  onRemove?: (name: string) => void; empty?: string; className?: string;
}) {
  if (files.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className={cn("flex flex-col", className)}>
      {files.map((f) => <FileRow key={f.name} {...f} onRemove={onRemove ? () => onRemove(f.name) : undefined} />)}
    </div>
  );
}

import { FileSize } from "@/components/ui/file-size";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { cn } from "@/lib/utils";
/** Attachments as chips, for under a message or a form. */
export function AttachmentList({ items, onOpen, className }: {
  items: { name: string; size?: number; href?: string }[];
  onOpen?: (name: string) => void; className?: string;
}) {
  return (
    <div data-slot="attachment-list" className={cn("flex flex-wrap gap-2", className)}>
      {items.map((a) => {
        const inner = (
          <>
            <FileTypeIcon name={a.name} className="size-3.5" />
            <span className="max-w-40 truncate">{a.name}</span>
            {a.size != null && <span className="text-muted-foreground"><FileSize bytes={a.size} /></span>}
          </>
        );
        const cls = "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted";
        return a.href
          ? <a key={a.name} href={a.href} className={cls}>{inner}</a>
          : <button key={a.name} type="button" className={cn(cls, "cursor-pointer")} onClick={() => onOpen?.(a.name)}>{inner}</button>;
      })}
    </div>
  );
}

import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * Code, with a copy button.
 *
 * No syntax highlighting on purpose — that means shipping a highlighter (shiki
 * is ~1 MB) for something most business sites use once, on a page showing an API
 * key or an address.
 */
export function CodeBlock({ code, language, className }: {
  code: string; language?: string; className?: string;
}) {
  return (
    <div className={cn("relative rounded-lg border bg-muted/50", className)}>
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{language ?? "code"}</span>
        <CopyButton value={code} label="Copy" className="h-6 px-2 text-xs" />
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

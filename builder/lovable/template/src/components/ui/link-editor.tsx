import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The little panel for adding or fixing a link.
 *
 * IT REFUSES `javascript:` AND `data:` and says why. A link editor that
 * accepts whatever is typed is how a script URL gets into content that is
 * then rendered somewhere less careful.
 *
 * A bare domain gets `https://` put in front rather than being rejected —
 * people type `example.com`, and turning that into a broken relative link is
 * the other common failure.
 */
export function LinkEditor({ href, text, onSave, onRemove, className }: {
  href?: string; text?: string;
  onSave: (v: { href: string; text: string; newTab: boolean }) => void;
  onRemove?: () => void; className?: string;
}) {
  const [url, setUrl] = React.useState(href ?? "");
  const [label, setLabel] = React.useState(text ?? "");
  const [newTab, setNewTab] = React.useState(false);
  const cleaned = url.trim();
  const unsafe = /^(javascript|data|vbscript):/i.test(cleaned);
  const normalised = !cleaned || unsafe ? cleaned
    : /^(https?:|mailto:|tel:|\/|#)/i.test(cleaned) ? cleaned : "https://" + cleaned;
  return (
    <div className={cn("w-72 space-y-3 rounded-md border border-border bg-popover p-3 shadow-md", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="le-url" className="text-xs">Link to</Label>
        <Input id="le-url" value={url} placeholder="example.com" aria-invalid={unsafe} className="h-8"
          onChange={(e) => setUrl(e.target.value)} />
        {unsafe && <p role="alert" className="text-xs text-destructive">That kind of link isn't allowed.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="le-text" className="text-xs">Text</Label>
        <Input id="le-text" value={label} className="h-8" onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="le-tab" checked={newTab} onCheckedChange={(v) => setNewTab(v === true)} />
        <Label htmlFor="le-tab" className="flex items-center gap-1 text-xs font-normal">
          Open in a new tab <ExternalLink className="size-3" />
        </Label>
      </div>
      <div className="flex items-center justify-between gap-2">
        {onRemove
          ? <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="size-4" />Remove</Button>
          : <span />}
        <Button type="button" size="sm" disabled={!normalised || unsafe}
          onClick={() => onSave({ href: normalised, text: label || normalised, newTab })}>Save</Button>
      </div>
    </div>
  );
}

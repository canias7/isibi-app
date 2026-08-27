import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormatToolbar, type FormatCommand } from "@/components/ui/format-toolbar";
import { CharLimitRing } from "@/components/ui/char-limit-ring";
import { cn } from "@/lib/utils";
/**
 * A markdown box with a toolbar that actually edits the text.
 *
 * A plain textarea underneath, on purpose: what somebody types is what gets
 * stored, they can select and copy it, and it works with every password
 * manager, spellchecker and mobile keyboard. A rich contentEditable buys a
 * prettier box and loses all of that.
 *
 * THE SELECTION IS RESTORED after every command. Setting a textarea's value
 * puts the caret at the end, so without this each toolbar press throws you to
 * the bottom of the document — the reason hand-rolled editors feel broken.
 */
const WRAP: Partial<Record<FormatCommand, [string, string]>> = {
  bold: ["**", "**"], italic: ["_", "_"], strike: ["~~", "~~"], code: ["`", "`"],
};
const PREFIX: Partial<Record<FormatCommand, string>> = {
  heading: "## ", quote: "> ", bullet: "- ", ordered: "1. ",
};
export function MarkdownEditor({ value, onChange, rows = 10, max, placeholder, className }: {
  value: string; onChange: (v: string) => void; rows?: number; max?: number;
  placeholder?: string; className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const apply = (cmd: FormatCommand) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const picked = value.slice(start, end);
    let next = value, caret = end;
    const wrap = WRAP[cmd];
    if (wrap) {
      next = value.slice(0, start) + wrap[0] + picked + wrap[1] + value.slice(end);
      caret = end + wrap[0].length + (picked ? wrap[1].length : 0);
    } else if (cmd === "link") {
      next = value.slice(0, start) + "[" + (picked || "text") + "](url)" + value.slice(end);
      caret = start + (picked || "text").length + 3;
    } else {
      const mark = PREFIX[cmd] ?? "";
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + mark + value.slice(lineStart);
      caret = end + mark.length;
    }
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };
  return (
    <div data-slot="markdown-editor" className={cn("space-y-2", className)}>
      <FormatToolbar onCommand={apply}
        only={["bold", "italic", "strike", "heading", "quote", "code", "bullet", "ordered", "link"]} />
      <Textarea ref={ref} value={value} rows={rows} placeholder={placeholder}
        className="font-mono text-sm" onChange={(e) => onChange(e.target.value)} />
      {max != null && (
        <div className="flex justify-end"><CharLimitRing value={value.length} max={max} /></div>
      )}
    </div>
  );
}

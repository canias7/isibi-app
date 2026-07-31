import * as React from "react";
import { FormatToolbar, type FormatCommand } from "@/components/ui/format-toolbar";
import { usePasteClean } from "@/components/ui/paste-clean";
import { cn } from "@/lib/utils";
const CMD: Partial<Record<FormatCommand, string>> = {
  bold: "bold", italic: "italic", underline: "underline", strike: "strikeThrough",
  bullet: "insertUnorderedList", ordered: "insertOrderedList",
};
/**
 * A what-you-see editor, on contentEditable.
 *
 * IT IS UNCONTROLLED, and that is the whole design. Writing React state back
 * into a contentEditable on every keystroke destroys and rebuilds the DOM
 * under the caret, which sends the cursor to the start of the document on
 * every character — the single reason hand-rolled rich editors are unusable.
 * The initial HTML is set once and changes are reported OUT.
 *
 * Paste is cleaned, or a paste from Word carries fonts and colours that then
 * override the site's own.
 *
 * `document.execCommand` is deprecated and still the only thing every browser
 * implements for this. When it goes, the replacement is a real editor
 * library; this is the honest small version until then, and `markdown-editor`
 * is the alternative that needs none of it.
 */
export function RichText({ defaultValue = "", onChange, placeholder, minHeight = 160, className }: {
  defaultValue?: string; onChange?: (html: string) => void;
  placeholder?: string; minHeight?: number; className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<FormatCommand[]>([]);
  const { onPasteContentEditable } = usePasteClean();

  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== defaultValue) ref.current.innerHTML = defaultValue;
    // Deliberately not depending on `defaultValue` after mount — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readActive = () => {
    const on: FormatCommand[] = [];
    for (const [k, v] of Object.entries(CMD)) {
      try { if (document.queryCommandState(v)) on.push(k as FormatCommand); } catch { /* unsupported */ }
    }
    setActive(on);
  };

  const run = (cmd: FormatCommand) => {
    const native = CMD[cmd];
    if (native) document.execCommand(native);
    else if (cmd === "heading") document.execCommand("formatBlock", false, "h3");
    else if (cmd === "quote") document.execCommand("formatBlock", false, "blockquote");
    else if (cmd === "link") {
      const url = window.prompt("Link to");
      if (url && !/^(javascript|data|vbscript):/i.test(url.trim())) document.execCommand("createLink", false, url.trim());
    }
    ref.current?.focus();
    readActive();
    onChange?.(ref.current?.innerHTML ?? "");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <FormatToolbar active={active} onCommand={run}
        only={["bold", "italic", "underline", "strike", "heading", "quote", "bullet", "ordered", "link"]} />
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
        data-placeholder={placeholder} style={{ minHeight }}
        className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&:empty::before]:text-muted-foreground [&:empty::before]:content-[attr(data-placeholder)] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline"
        onInput={() => onChange?.(ref.current?.innerHTML ?? "")}
        onKeyUp={readActive} onMouseUp={readActive}
        onPaste={onPasteContentEditable} />
    </div>
  );
}

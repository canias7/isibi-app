import * as React from "react";
import { FormatToolbar, type FormatCommand } from "@/components/ui/format-toolbar";
import { usePasteClean } from "@/components/ui/paste-clean";
import { cn } from "@/lib/utils";
const CMD: Partial<Record<FormatCommand, string>> = {
  bold: "bold", italic: "italic", underline: "underline", strike: "strikeThrough",
  bullet: "insertUnorderedList", ordered: "insertOrderedList",
};
// Exactly what `run()` below can produce, and nothing else. This is an
// allow-list, which `paste-clean` argues against — "that list is always one tag
// out of date" — and the objection does not reach here. It is about a list
// drifting from what real-world HTML contains; this list is derived from the
// editor's OWN command set, twelve lines down, so the only thing that can add
// to it is a new command in the same file.
const KEEP = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "H3", "BLOCKQUOTE", "UL", "OL", "LI", "A", "SPAN"]);
// Removed WITH their contents. Everything else unknown is unwrapped instead,
// keeping the words and losing the tag — dropping it whole would silently eat a
// paragraph over one unexpected wrapper.
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK",
  "META", "NOSCRIPT", "TEMPLATE", "SVG", "MATH"]);

/**
 * `defaultValue` is HTML, and it is assigned to `innerHTML` — so it is a script
 * injection unless it is cleaned first.
 *
 * WHY THIS IS NOT OBVIOUS FROM THE OUTSIDE, which is the actual defect: the
 * signature says `defaultValue?: string`, which reads exactly like an
 * `<input defaultValue>` — a plain string. React makes you type
 * `dangerouslySetInnerHTML` precisely so the danger is visible at the call
 * site, and assigning `.innerHTML` by hand is the same act with the warning
 * removed. `markdown-preview` in this same kit refuses to do it and says why:
 * "stored XSS on any site that lets a visitor write anything."
 *
 * The exposure is real on a generated site. A `collect` table holds whatever a
 * visitor typed, and the owner opening that row in an editor is the obvious
 * page to build. `<script>` inserted via innerHTML does not run — but
 * `<img src=x onerror=…>` does, and that is the whole attack.
 *
 * DOMParser is INERT: parsing does not run scripts, fire handlers or fetch
 * anything, so the document is only ever walked, never live.
 */
export function cleanEditorHtml(html: string): string {
  // Client-only: it is called from the mount effect. Refusing rather than
  // returning the input keeps the unsafe value from ever reaching innerHTML.
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) walk(child);
    const tag = el.tagName.toUpperCase();
    if (DROP.has(tag)) { el.remove(); return; }
    for (const attr of Array.from(el.attributes)) {
      // The ONLY attribute that survives, on the only tag that carries one.
      // An allow-list, not a deny-list of `on*`: `onerror` is the famous one
      // and it is not the only one, and a deny-list has to be complete.
      const keep = tag === "A" && attr.name.toLowerCase() === "href"
        && /^\s*(https?:|mailto:)/i.test(attr.value);
      if (!keep) el.removeAttribute(attr.name);
    }
    if (!KEEP.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
    }
  };
  for (const el of Array.from(doc.body.children)) walk(el);
  return doc.body.innerHTML;
}

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
export function RichText({ defaultValue = "", onChange, label, placeholder, minHeight = 160, className }: {
  defaultValue?: string; onChange?: (html: string) => void;
  /** What this editor is FOR. A placeholder is not a name — it is drawn by a
   *  CSS `content:` rule and is not in the accessibility tree at all. */
  label?: string;
  placeholder?: string; minHeight?: number; className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<FormatCommand[]>([]);
  const { onPasteContentEditable } = usePasteClean();

  React.useEffect(() => {
    const safe = cleanEditorHtml(defaultValue);
    if (ref.current && ref.current.innerHTML !== safe) ref.current.innerHTML = safe;
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
        aria-label={label ?? placeholder ?? "Rich text"}
        data-placeholder={placeholder} style={{ minHeight }}
        className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&:empty::before]:text-muted-foreground [&:empty::before]:content-[attr(data-placeholder)] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline"
        onInput={() => onChange?.(ref.current?.innerHTML ?? "")}
        onKeyUp={readActive} onMouseUp={readActive}
        onPaste={onPasteContentEditable} />
    </div>
  );
}

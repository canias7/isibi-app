import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A paste target for screenshots — scoped, never global.
 *
 * THE LISTENER IS ON THE ELEMENT, NOT THE DOCUMENT. A global paste
 * handler steals Ctrl+V from every text field on the page — the person
 * pasting a customer's address into a note suddenly uploads their
 * clipboard screenshot instead. Scoped, the target must be FOCUSED to
 * receive, so it is focusable, says what it is for, and shows its focus.
 *
 * NON-IMAGE PASTES PASS THROUGH UNTOUCHED — text pasted here is just
 * not our business, and preventDefault only fires when an image was
 * actually taken, so the browser's own behaviour survives.
 *
 * The preview uses an object URL, revoked on replacement and unmount
 * (the attachment-tray rule).
 */
export function PasteImage({ onImage, label = "Click, then paste a screenshot (Ctrl+V)", className }: {
  onImage: (file: File) => void;
  label?: React.ReactNode;
  className?: string;
}) {
  const [preview, setPreview] = React.useState<string | null>(null);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label="Paste an image here"
      onPaste={(e) => {
        const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
        if (!item) return; // text pastes are not our business
        const file = item.getAsFile();
        if (!file) return;
        e.preventDefault();
        setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
        onImage(file);
      }}
      className={cn(
        "flex min-h-24 cursor-text flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground",
        "focus-visible:border-foreground focus-visible:outline-none",
        className,
      )}
    >
      {preview
        ? <img src={preview} alt="Pasted image" className="max-h-32 rounded-md border border-border" />
        : label}
    </div>
  );
}

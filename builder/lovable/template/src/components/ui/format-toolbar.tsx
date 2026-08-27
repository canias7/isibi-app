import * as React from "react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Bold, Italic, Underline, Strikethrough, Link2, List, ListOrdered, Code, Quote, Heading2 } from "lucide-react";
import { cn } from "@/lib/utils";
export type FormatCommand =
  | "bold" | "italic" | "underline" | "strike" | "link"
  | "bullet" | "ordered" | "code" | "quote" | "heading";
/**
 * The buttons above an editor.
 *
 * It holds NO state and knows nothing about the editor — it reports a command
 * and is told which are currently active. That is what lets the same toolbar
 * sit above a markdown textarea, a contentEditable, or anything else; a
 * toolbar that owns the document can only ever drive one of them.
 *
 * Every button has a real label. An icon-only toolbar is a row of unlabelled
 * buttons to a screen reader, and B/I/U are only obvious to people who
 * already know them.
 */
const BUTTONS: { cmd: FormatCommand; icon: React.ComponentType<{ className?: string }>; label: string; group: number }[] = [
  { cmd: "bold", icon: Bold, label: "Bold", group: 0 },
  { cmd: "italic", icon: Italic, label: "Italic", group: 0 },
  { cmd: "underline", icon: Underline, label: "Underline", group: 0 },
  { cmd: "strike", icon: Strikethrough, label: "Strikethrough", group: 0 },
  { cmd: "heading", icon: Heading2, label: "Heading", group: 1 },
  { cmd: "quote", icon: Quote, label: "Quote", group: 1 },
  { cmd: "code", icon: Code, label: "Code", group: 1 },
  { cmd: "bullet", icon: List, label: "Bulleted list", group: 2 },
  { cmd: "ordered", icon: ListOrdered, label: "Numbered list", group: 2 },
  { cmd: "link", icon: Link2, label: "Link", group: 3 },
];
export function FormatToolbar({ onCommand, active = [], only, className }: {
  onCommand: (cmd: FormatCommand) => void; active?: FormatCommand[];
  only?: FormatCommand[]; className?: string;
}) {
  const shown = only ? BUTTONS.filter((b) => only.includes(b.cmd)) : BUTTONS;
  return (
    <div data-slot="format-toolbar" className={cn("flex flex-wrap items-center gap-0.5 rounded-md border border-border p-1", className)}
      role="toolbar" aria-label="Formatting">
      {shown.map((b, i) => {
        const Icon = b.icon;
        const gap = i > 0 && shown[i - 1].group !== b.group;
        return (
          <React.Fragment key={b.cmd}>
            {gap && <Separator orientation="vertical" className="mx-1 h-5" />}
            <Toggle size="sm" pressed={active.includes(b.cmd)} aria-label={b.label} title={b.label}
              onPressedChange={() => onCommand(b.cmd)}>
              <Icon className="size-4" />
            </Toggle>
          </React.Fragment>
        );
      })}
    </div>
  );
}

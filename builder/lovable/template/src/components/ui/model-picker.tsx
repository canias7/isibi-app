import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
/**
 * Choosing which model answers.
 *
 * Each option says what it is FOR — "quick answers and simple edits" versus
 * "hard reasoning, slower" — because a model name is an internal identifier
 * and version numbers tell nobody which one to pick. That single sentence is
 * the entire user-facing difference between them.
 *
 * An UNAVAILABLE model stays in the list, disabled, with the reason: "on the
 * Pro plan". Removing it means somebody who read about it goes looking and
 * concludes the feature is broken, and it removes the one moment where saying
 * what an upgrade buys is genuinely useful rather than an interruption.
 *
 * The trigger shows the model's SHORT name only. This control sits in a toolbar
 * that also holds attachments and a send button, and a full name plus a version
 * string crowds all of it out on a phone.
 */
export function ModelPicker({ models, value, onChange, className }: {
  models: { key: string; name: string; short?: string; description?: React.ReactNode; badge?: React.ReactNode; disabled?: boolean; reason?: React.ReactNode }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = models.find((m) => m.key === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Model: ${current?.name ?? "choose"}`}
          className={cn("inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted", className)}>
          {current?.short ?? current?.name ?? "Choose a model"}
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <ul>
          {models.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                disabled={m.disabled}
                onClick={() => { onChange(m.key); setOpen(false); }}
                aria-current={m.key === value ? "true" : undefined}
                className={cn("flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-start hover:bg-muted",
                  m.disabled && "cursor-default opacity-60 hover:bg-transparent")}
              >
                <Check aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", m.key === value ? "" : "invisible")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2 text-sm font-medium">
                    {m.name}
                    {m.badge ? <span className="text-[10px] font-normal text-muted-foreground">{m.badge}</span> : null}
                  </span>
                  {m.description ? (
                    <span className="block text-xs text-muted-foreground">{m.description}</span>
                  ) : null}
                  {m.disabled && m.reason ? (
                    <span className="block text-xs font-medium">{m.reason}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

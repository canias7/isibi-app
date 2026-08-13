import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick several. Built on `command` inside a `popover`, which is how shadcn does
 * a searchable select — there is no multi-select primitive.
 */
export function MultiSelect({ options, value, onChange, placeholder = "Select…", className }: {
  options: { value: string; label: string }[];
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn("h-auto min-h-9 w-full justify-between font-normal", className)}>
          <span className="flex flex-wrap gap-1">
            {value.length === 0 ? <span className="text-muted-foreground">{placeholder}</span>
              : value.map((v) => (
                <Badge key={v} variant="secondary" className="gap-1">
                  {label(v)}
                  {/* A MOUSE SHORTCUT, AND HIDDEN FROM ASSISTIVE TECH ON PURPOSE.
                      This was `role="button"` with an `aria-label`, sitting
                      inside the trigger `<button>` with `tabIndex={-1}` and no
                      key handler — so it announced an operable control that no
                      keyboard or screen-reader user could ever reach or fire,
                      and it put an interactive role inside an interactive
                      element, which ARIA does not allow.

                      Removing is NOT lost: every option in the list below
                      toggles, so deselecting is fully available through the
                      combobox, which is where a keyboard user does it anyway.
                      What went is a DUPLICATE control that was only ever
                      announced, never operable. Giving it a real one means the
                      trigger stops being a `<button>`, which is a change to how
                      this component looks and behaves rather than a fix. */}
                  <span aria-hidden className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggle(v); }}><X className="size-3" /></span>
                </Badge>
              ))}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                  <Check className={cn("size-4", value.includes(o.value) ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

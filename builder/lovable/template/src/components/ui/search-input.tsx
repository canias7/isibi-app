import * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Search, X } from "lucide-react";
/**
 * Search, with a clear button.
 *
 * `type="search"` so mobile keyboards show a Search key, and the clear button is
 * ours rather than the browser's, which only some of them draw.
 */
export function SearchInput({ value, onChange, placeholder = "Search…", id, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; id?: string; className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon><Search className="size-4" /></InputGroupAddon>
      <InputGroupInput id={id} type="search" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      {value && (
        <InputGroupAddon align="inline-end">
          <button type="button" aria-label="Clear search" onClick={() => onChange("")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

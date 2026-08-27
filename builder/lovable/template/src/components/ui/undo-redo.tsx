import * as React from "react";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * An undo stack for anything, and the two buttons that drive it.
 *
 * The stack lives in a ref rather than state — pushing a value must not cause
 * a render, or every keystroke in the editor above re-renders the whole tree.
 *
 * A new push CLEARS the redo branch. That is what every editor does and what
 * people expect: having undone three steps and then typed, redo would
 * otherwise re-apply edits to text that no longer exists.
 */
export function useUndoRedo<T>(initial: T, limit = 100) {
  const past = React.useRef<T[]>([]);
  const future = React.useRef<T[]>([]);
  const [value, setValue] = React.useState(initial);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  const set = React.useCallback((next: T) => {
    setValue((prev) => {
      past.current = [...past.current.slice(-(limit - 1)), prev];
      future.current = [];
      return next;
    });
    bump();
  }, [limit]);

  const undo = React.useCallback(() => {
    setValue((prev) => {
      const p = past.current.pop();
      if (p === undefined) return prev;
      future.current = [prev, ...future.current];
      return p;
    });
    bump();
  }, []);

  const redo = React.useCallback(() => {
    setValue((prev) => {
      const [f, ...rest] = future.current;
      if (f === undefined) return prev;
      future.current = rest;
      past.current = [...past.current, prev];
      return f;
    });
    bump();
  }, []);

  return { value, set, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
export function UndoRedo({ onUndo, onRedo, canUndo, canRedo, className }: {
  onUndo: () => void; onRedo: () => void; canUndo?: boolean; canRedo?: boolean; className?: string;
}) {
  return (
    <div data-slot="undo-redo" className={cn("flex items-center gap-1", className)}>
      <Button type="button" size="icon-sm" variant="ghost" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
        <Undo2 className="size-4" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
        <Redo2 className="size-4" />
      </Button>
    </div>
  );
}

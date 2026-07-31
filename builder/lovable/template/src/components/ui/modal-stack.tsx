import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * More than one dialog open at a time, without them fighting.
 *
 * ESCAPE CLOSES THE TOP ONE ONLY. The naive implementation gives every open
 * dialog a keydown listener, so one Escape closes all of them and the person
 * who opened a confirmation from inside a form loses the form as well. The
 * stack is what makes "the top one" a thing that can be known.
 *
 * Each dialog registers its `onClose` ALONGSIDE its id, and Escape calls it.
 * The first version removed the id from the stack's own list instead — which
 * changed nothing, because `open` is a controlled prop the parent still had set
 * to true, so the dialog re-registered on the next render and Escape did
 * nothing at all. Measured: two dialogs open, Escape, two dialogs open. A
 * stack that knows which one is on top and cannot close it is not a stack.
 *
 * ONE SCRIM for the whole stack, not one per dialog. Two translucent black
 * layers is visibly darker than one, so a second dialog dims the page again and
 * a third makes it nearly black.
 *
 * `overflow: hidden` on the body is restored only when the LAST dialog closes,
 * counted rather than toggled — closing the top of two otherwise re-enables
 * scrolling behind the one still open.
 *
 * `useModalStack` is a context so the components need not be siblings; a
 * dialog opened from deep inside a form still registers on the same stack.
 */
type StackApi = {
  open: (id: string) => void;
  close: (id: string) => void;
  register: (id: string, onClose: () => void) => void;
  top: string | null;
  depth: number;
};
const Ctx = React.createContext<StackApi | null>(null);

export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = React.useState<string[]>([]);
  // Written on every render rather than through an effect: an inline
  // `onClose={() => …}` is a new function each time, and registering it in an
  // effect would churn the stack on every parent render.
  const closers = React.useRef(new Map<string, () => void>());
  const open = React.useCallback((id: string) => setIds((xs) => (xs.includes(id) ? xs : [...xs, id])), []);
  const close = React.useCallback((id: string) => setIds((xs) => xs.filter((x) => x !== id)), []);
  const register = React.useCallback((id: string, onClose: () => void) => {
    closers.current.set(id, onClose);
  }, []);

  React.useEffect(() => {
    if (ids.length === 0) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [ids.length > 0]);

  React.useEffect(() => {
    if (ids.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      const top = ids[ids.length - 1];
      closers.current.get(top)?.();
      close(top);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ids, close]);

  const api = React.useMemo<StackApi>(
    () => ({ open, close, register, top: ids[ids.length - 1] ?? null, depth: ids.length }),
    [open, close, register, ids]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {ids.length > 0 ? <div aria-hidden className="fixed inset-0 z-40 bg-foreground/50" /> : null}
    </Ctx.Provider>
  );
}

export function useModalStack() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useModalStack must be used inside a ModalStackProvider");
  return ctx;
}

export function StackedModal({ id, open, onClose, title, children, footer, className }: {
  id: string;
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const stack = useModalStack();
  const { open: push, close: pop, register } = stack;

  register(id, onClose);

  React.useEffect(() => {
    if (open) push(id); else pop(id);
    return () => pop(id);
  }, [open, id, push, pop]);

  if (!open) return null;
  const isTop = stack.top === id;

  return (
    <div
      role="dialog"
      aria-modal={isTop}
      aria-label={typeof title === "string" ? title : undefined}
      className={cn("fixed inset-0 z-50 grid place-items-center p-4", !isTop && "pointer-events-none")}
    >
      <div
        onClick={(e) => { if (e.target === e.currentTarget && isTop) onClose(); }}
        className="absolute inset-0"
      />
      <div className={cn("relative flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-xl",
        !isTop && "scale-95 opacity-70", className)}>
        {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
        <div className="min-w-0">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

import * as React from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A full-screen image viewer.
 *
 * It restores FOCUS to whatever opened it. A lightbox that closes and drops
 * focus onto `<body>` throws a keyboard user back to the top of the page, which
 * on a gallery of forty photographs means tabbing all the way down again for
 * every single one.
 *
 * Focus is TRAPPED while it is open, and Escape always closes. Both are things
 * `<dialog showModal>` gives for free, and it is used here for exactly that
 * reason rather than a hand-rolled overlay — the inert background and the
 * top-layer stacking come with it, so no z-index has to be guessed.
 *
 * The BODY does not scroll behind it. Otherwise a wheel gesture over the image
 * scrolls the page underneath, and closing leaves the reader somewhere else
 * entirely.
 *
 * Arrow keys move between images, and the position — "3 of 12" — is always on
 * screen: in a full-screen view with no surrounding page there is nothing else
 * to say how much is left.
 */
export function Lightbox({ images, index, onClose, onIndexChange, className }: {
  images: { src: string; alt?: string; caption?: React.ReactNode }[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const open = index != null && index >= 0 && index < images.length;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      el.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  React.useEffect(() => () => { document.body.style.overflow = ""; }, []);

  const close = () => {
    document.body.style.overflow = "";
    onClose();
    opener.current?.focus();
  };
  const step = (d: number) => {
    if (index == null) return;
    onIndexChange((index + d + images.length) % images.length);
  };
  const current = open ? images[index] : null;

  return (
    <dialog
      ref={ref}
      onClose={close}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === ref.current) close(); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      }}
      aria-label="Image viewer"
      className={cn("m-0 h-full max-h-none w-full max-w-none bg-foreground/95 p-0 backdrop:bg-transparent", className)}
    >
      {current ? (
        <div className="flex h-full flex-col text-background">
          <div className="flex items-center justify-between p-3">
            <span className="text-xs tabular-nums">{(index ?? 0) + 1} of {images.length}</span>
            <button type="button" onClick={close} aria-label="Close"
              className="cursor-pointer rounded p-1.5 hover:bg-background/20">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center gap-2 px-2">
            {images.length > 1 ? (
              <button type="button" onClick={() => step(-1)} aria-label="Previous image"
                className="shrink-0 cursor-pointer rounded-full p-2 hover:bg-background/20">
                <ChevronLeft aria-hidden className="size-6" />
              </button>
            ) : null}
            <img src={current.src} alt={current.alt ?? ""} className="mx-auto max-h-full min-h-0 flex-1 object-contain" />
            {images.length > 1 ? (
              <button type="button" onClick={() => step(1)} aria-label="Next image"
                className="shrink-0 cursor-pointer rounded-full p-2 hover:bg-background/20">
                <ChevronRight aria-hidden className="size-6" />
              </button>
            ) : null}
          </div>
          <p className="min-h-10 p-3 text-center text-sm">{current.caption}</p>
        </div>
      ) : null}
    </dialog>
  );
}

"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    data-slot="overlay"
    className={cn(
      "fixed inset-0 z-50 bg-(--scrim)  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

// `bg-popover`, NOT `bg-background`, and that is not a cosmetic preference.
//
// A theme with a decorative backdrop re-emits `--background` at 35% alpha on
// purpose (`openRootCss` in site-theme.mjs): every generated page's root div
// carries `bg-background`, and an opaque token would hide the wash the theme
// paints on the body. Correct for the page ROOT — and this panel is not the
// root. Measured live on a published site: the mobile menu rendered
// see-through, with the page's own headings legible straight through it.
//
// `--popover` is the token for a FLOATING surface and is handled correctly by
// both paths: opaque under a backdrop theme, translucent WITH backdrop-blur
// under a glass one, which is readable by design. Upstream shadcn says
// `bg-background` here, so a component refresh will try to put it back.
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-popover p-6 shadow-lg transition ease-standard data-[state=closed]:duration-(--dur-3) data-[state=open]:duration-(--dur-4) data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // THE HORIZONTAL SIDES MIXED ONE LOGICAL PROPERTY WITH ONE PHYSICAL ONE,
        // and on a right-to-left site the panel therefore flew across the whole
        // screen to get where it was going. Found on a real published Arabic
        // site (`layali-dubai`, 2026-08-21) by tapping the menu on a phone.
        //
        // `end-0` is LOGICAL and flips — measured, the panel lands at `left: 0`
        // in RTL, which is correct. `slide-in-from-right` compiles to
        // `translate3d(100%, 0, 0)`, and a CSS transform is PHYSICAL: `dir` does
        // not touch it, so the entrance still started off the right-hand edge.
        // Position mirrored, motion not — the half-mirrored failure this repo
        // already records as worse than not mirroring at all.
        //
        // Tailwind ships NO logical slide utility (`slide-in-from-start/end`:
        // zero hits in a compiled bundle), so the direction has to be selected
        // rather than expressed. `top`/`bottom` need nothing — vertical motion
        // does not mirror.
        //
        // THE OVERRIDE WINS ON SOURCE ORDER, NOT SPECIFICITY, which is why
        // `test/sheet-rtl.test.mjs` asserts the COMPILED output rather than
        // these strings: `rtl:` expands through `:where(…)`, which contributes
        // nothing, so both rules land at (0,2,0) and only Tailwind emitting the
        // rtl one second makes this work. If that ever changed the fix would go
        // silently dead, and the only symptom would be a menu sliding the wrong
        // way on Arabic sites — which nobody would connect to a Tailwind bump.
        left: "inset-y-0 start-0 h-full w-3/4 border-e data-[state=closed]:slide-out-to-left rtl:data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-left rtl:data-[state=open]:slide-in-from-right sm:max-w-sm",
        right:
          "inset-y-0 end-0 h-full w-3/4 border-s data-[state=closed]:slide-out-to-right rtl:data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-right rtl:data-[state=open]:slide-in-from-left sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close className="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-start", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

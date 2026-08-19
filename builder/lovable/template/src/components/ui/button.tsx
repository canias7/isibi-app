import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        // The v4 sizes, added 2026-07-30 so v4-only components can be used here.
        // `attachment`, `message-scroller` and `combobox` are all written against
        // them and fail to typecheck without them (TS2322, measured).
        //
        // Deliberately ADDITIVE: the four above are untouched, so nothing that
        // renders today can change. Taking v4's button wholesale would have
        // rewritten every existing size AND reverted this file's local edits
        // (`cursor-pointer`, `disabled:cursor-not-allowed`), which is the exact
        // damage `--overwrite` did here once already.
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      // `data-slot` IS THE STYLING HOOK, and it replaces a structural guess.
      //
      // The theme's button axis used to select `button.justify-center,
      // a.justify-center.whitespace-nowrap` — a guess at two utility classes
      // `buttonVariants` happens to emit, which holds today and breaks silently
      // the day a kit refresh reorders them. This is exact, and it is what
      // upstream shadcn stamps on every primitive.
      //
      // A STYLED BUTTON, NOT EVERY `<button>`, and that distinction is the whole
      // point: 450 kit files write a raw `<button>` — accordion triggers, sort
      // toggles, close crosses, hamburgers — against 220 that use this. "Make
      // the buttons rounder" means the ones that look like buttons, so
      // pill-shaping an accordion trigger would be wrong.
      //
      // BEFORE `{...props}` so a caller can override it, and it survives
      // `asChild`: `Slot` merges onto the child, so `<Button asChild><Link/>`
      // renders an `<a data-slot="button">` — which is the half of the old
      // selector that needed `a.justify-center.whitespace-nowrap`.
      <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// TITLE AND DESCRIPTION ARE PROPS AS WELL AS CHILDREN, added 2026-08-04.
// Measured: three of three eval samples wrote `<Empty title description />`
// and every one failed to compile — eleven TS2322s, the only error class in
// the run, so the whole site fell back to the placeholder three times over.
// The model is not guessing wildly: `DataList` takes `empty={{title,
// description}}`, and carrying that shape onto the component underneath is
// what a reasonable caller assumes. Same call as the button sizes — a missing
// prop, not a fork in the design system — so this is ADDITIVE and the compound
// form is untouched, which is what `DataList` itself still uses.
//
// `title` MUST be re-typed rather than merely added. A div already has an HTML
// `title`, so leaving it alone leaves the call compiling and rendering the
// heading as a browser TOOLTIP: invisible, and worse than the error.
// `heading` IS AN ALIAS FOR `title`, added 2026-08-04 after the same component
// took a second live build down: `manage.tsx(26,13) TS2322: Type '{ heading:
// string; description: string; }' is not assignable`, reproduced here byte for
// byte before anything was changed.
//
// The reason the model reaches for `heading` is written two paragraphs up: a div
// already owns `title`, so this component had to Omit it. A prop name that
// collides with an HTML attribute is one a caller will not land on first try,
// and the alias costs nothing — `title` stays primary and every existing call,
// including `DataList`'s, is untouched. Additive, like the button sizes.
function Empty({
  className,
  title,
  heading,
  description,
  icon,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title?: React.ReactNode
  /** Alias for `title`. `title` wins if both are given. */
  heading?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
}) {
  // `??`, not `||`: an empty string is a deliberate "no heading", and `||` would
  // silently fall through to the alias instead of honouring it.
  const head = title ?? heading
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
        className
      )}
      {...props}
    >
      {(icon || head || description) && (
        <EmptyHeader>
          {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
          {head && <EmptyTitle>{head}</EmptyTitle>}
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
      )}
      {children}
    </div>
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-lg font-medium tracking-tight", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}

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
function Empty({
  className,
  title,
  description,
  icon,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
        className
      )}
      {...props}
    >
      {(icon || title || description) && (
        <EmptyHeader>
          {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
          {title && <EmptyTitle>{title}</EmptyTitle>}
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

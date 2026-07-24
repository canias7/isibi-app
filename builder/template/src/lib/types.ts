// Shared prop shapes for the component kit.
//
// WHY THIS FILE EXISTS: the same handful of shapes recur across the kit — `{src, alt}` appears in 27
// components, `className` in all 258, `{label, value}` in a dozen. Left to themselves those drift into
// near-identical duplicates, and reconciling hundreds of them later is the expensive part of growing a
// component library. One definition each, imported everywhere, keeps the kit coherent as it scales.
//
// Everything here is type-only, so it compiles away to nothing at runtime.

import type { ComponentType, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// ─── Universal ───────────────────────────────────────────────────────────────

/** Every component accepts a className that is merged with cx(). */
export interface BaseProps {
  className?: string
}

/** Components that wrap arbitrary content. */
export interface WithChildren {
  children?: ReactNode
}

/**
 * An icon slot. Most components receive the lucide COMPONENT and render `<Icon size={16} />`;
 * a few take an already-rendered node instead. Both are legal, so both are allowed.
 */
export type IconLike = LucideIcon | ComponentType<{ size?: number | string; className?: string }> | ReactNode

/** The lucide component form specifically — for slots that call `<Icon size={…} />`. */
export type IconComponent = LucideIcon | ComponentType<{ size?: number | string; className?: string }>

/** The shared size scale. Individual components may support a subset. */
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** Semantic status colour, shared by Alert, Badge, StatusPill, Progress and friends. */
export type Tone = 'neutral' | 'brand' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

// ─── Recurring data shapes ───────────────────────────────────────────────────
//
// IMPORTANT — these are OPEN, via `[key: string]: any`, and the prop interfaces are not. The distinction is
// deliberate:
//
//   • A component's own props (`AvatarProps`) stay CLOSED, so excess-property checking flags a misspelled
//     prop and a literal union rejects `size="xs"`. That is the entire reason we type the kit.
//   • The DATA you pass through those props is your app's, not ours. An attendee has a name — and probably a
//     company, a ticket type and a check-in flag too. Closing these shapes would reject every real dataset.
//
// So the shape below states the minimum a component relies on, and lets an app carry whatever else it needs.

/** An image. Used by Gallery, Lightbox, Carousel, Masonry, FeedPost and ~22 others. */
export interface ImageItem {
  [key: string]: any
  src: string
  alt?: string
  caption?: string
}

/** A label/value pair — DescriptionList, StatsBand, MetricComparison, detail rows. */
export interface LabelValue {
  [key: string]: any
  label: string
  value: ReactNode
}

/** A destination — Breadcrumb, navLinks, TagCloud, footer columns. */
export interface LinkItem {
  [key: string]: any
  label: string
  to: string
  icon?: IconComponent
}

/** A selectable choice — Select, Combobox, MultiSelect, VariantPicker, JobFilters facets. */
export interface Option {
  [key: string]: any
  value: string
  label: string
  hint?: string
  count?: number
  disabled?: boolean
}

/** A collapsible entry — Accordion and FAQSection take the same shape. */
export interface TitledContent {
  [key: string]: any
  title: string
  content: ReactNode
}

/** A person — Avatar, UserCard, AvatarGroup, Comment, speakers, attendees, members. */
export interface Person {
  [key: string]: any
  name: string
  avatar?: string
  role?: string
}

/** A KPI figure — Stat, StatRow, ProfileHeader stats, UserCard stats. */
export interface StatItem {
  [key: string]: any
  label: string
  value: ReactNode
  delta?: string
  deltaLabel?: string
  icon?: IconComponent
  invertDelta?: boolean
}

/** A call to action. `to` navigates; otherwise onClick runs. */
export interface Cta {
  [key: string]: any
  label: string
  to?: string
  onClick?: () => void
}

/** One point in any of the simple chart components. */
export interface ChartPoint {
  [key: string]: any
  label: string
  value: number
}

/** A menu entry, or a separator between groups. */
export type MenuItem =
  | { label: string; onSelect?: () => void; icon?: ReactNode; danger?: boolean; separator?: false }
  | { separator: true }

/** A DataTable column. `render` receives the whole row. */
export interface Column<Row = any> {
  [key: string]: any
  key: string
  header: ReactNode
  render?: (row: Row) => ReactNode
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
}

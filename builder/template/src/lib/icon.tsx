import { createElement, isValidElement, type ReactNode } from 'react'
import type { IconComponent } from './types.ts'

/** An icon slot that accepts EITHER the lucide component or an already-built element. */
export type IconSlot = ReactNode | IconComponent

/**
 * Render an icon slot.
 *
 * The kit was split on this and it cost a real build: `EmptyState` declared `icon?: IconComponent`
 * and rendered `<Icon size={16} />`, while `Stat`, `PageHeader`, `Sidebar` and `NotificationItem`
 * declared `icon?: ReactNode` and rendered `{icon}`. Every starter and the shared docs pass the
 * COMPONENT (`icon={Inbox}`), so a generated page that followed the majority hit
 * "Type 'ForwardRefExoticComponent<…>' is not assignable to type 'ReactNode'" — a type error on
 * correct-looking code, in a prop whose two spellings are indistinguishable from the inventory.
 *
 * Accepting both removes the trap instead of documenting it, and every existing call site keeps
 * working: an element passes through untouched, a component is instantiated at the size asked for.
 */
export function renderIcon(icon: IconSlot, size = 16): ReactNode {
  if (!icon) return null
  if (typeof icon === 'function') return createElement(icon as IconComponent, { size })
  if (isValidElement(icon)) return icon
  return icon as ReactNode
}

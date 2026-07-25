import { useState } from 'react'
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface TreeViewProps {
  nodes?: any[]
  selectedId?: any
  onSelect?: (...args: any[]) => any
  defaultExpanded?: any[]
  expanded?: any
  onExpandedChange?: (...args: any[]) => any
  className?: string
}

// TreeView — nested hierarchies: file/folder browsers, category trees, org charts, nested comments, docs nav.
// nodes: [{id, label, icon, meta, children}]. Uncontrolled expansion by default; pass `expanded`/`onExpandedChange`
// (a Set or array of ids) to control it.
export default function TreeView({ nodes = [], selectedId, onSelect, defaultExpanded = [], expanded, onExpandedChange, className }: TreeViewProps) {
  const [openSelf, setOpenSelf] = useState(() => new Set(defaultExpanded))
  const openSet = expanded ? new Set(expanded) : openSelf
  const toggle = (id) => {
    const next = new Set(openSet)
    next.has(id) ? next.delete(id) : next.add(id)
    onExpandedChange ? onExpandedChange([...next]) : setOpenSelf(next)
  }

  const row = (node, depth) => {
    const kids = node.children || []
    const isOpen = openSet.has(node.id)
    const branch = kids.length > 0
    const Icon = node.icon || (branch ? (isOpen ? FolderOpen : Folder) : File)
    return (
      <li key={node.id} role="treeitem" aria-expanded={branch ? isOpen : undefined} aria-selected={selectedId === node.id}>
        <div
          className={cx('group flex items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm transition',
            selectedId === node.id ? 'bg-brand-50 text-brand-900' : 'text-ink-700 hover:bg-ink-100/70')}
          style={{ paddingLeft: 8 + depth * 16 }}>
          <button type="button" onClick={() => branch && toggle(node.id)} tabIndex={branch ? 0 : -1}
            aria-label={branch ? (isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`) : undefined}
            className={cx('grid h-4 w-4 shrink-0 place-items-center rounded text-ink-400 transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              branch ? 'hover:text-ink-700' : 'invisible')}>
            <ChevronRight size={13} className={cx('transition-transform', isOpen && 'rotate-90')} />
          </button>
          <Icon size={15} className={cx('shrink-0', selectedId === node.id ? 'text-brand-600' : 'text-ink-400')} />
          <button type="button" onClick={() => onSelect && onSelect(node)}
            className="min-w-0 flex-1 truncate py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {node.label}
          </button>
          {node.meta && <span className="shrink-0 text-xs tabular-nums text-ink-400">{node.meta}</span>}
        </div>
        {branch && isOpen && <ul role="group">{kids.map((k) => row(k, depth + 1))}</ul>}
      </li>
    )
  }

  return <ul role="tree" className={cx('select-none', className)}>{nodes.map((n) => row(n, 0))}</ul>
}

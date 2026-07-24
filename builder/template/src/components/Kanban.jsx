import { cx } from '../lib/cx.js'

// Kanban — a stage board (deal pipelines, task boards, order status). HTML5 drag-and-drop.
// columns: [{id, title, tone?}]  items: [{id, column, ...}]  renderCard(item) -> node
export default function Kanban({ columns = [], items = [], renderCard, onMove, summarize, className }) {
  return (
    <div className={cx('flex gap-4 overflow-x-auto pb-2', className)}>
      {columns.map((col) => {
        const cards = items.filter((i) => i.column === col.id)
        return (
          <div key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id && onMove) onMove(id, col.id) }}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-ink-50/70 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-ink-800">{col.title}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-ink-500">{cards.length}</span>
            </div>
            {summarize && <p className="mb-2 px-1 text-xs text-ink-400">{summarize(cards)}</p>}
            <div className="flex-1 space-y-2">
              {cards.map((it) => (
                <div key={it.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(it.id))}
                  className="cursor-grab rounded-xl border border-ink-100 bg-white p-3 shadow-sm transition hover:shadow-soft active:cursor-grabbing">
                  {renderCard ? renderCard(it) : it.title}
                </div>
              ))}
              {cards.length === 0 && <p className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">Drop here</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

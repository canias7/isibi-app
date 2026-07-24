import { cx } from '../lib/cx.js'

// Masonry — the Pinterest-style staggered column layout. Gallery is a uniform grid (every tile the same shape);
// this preserves each item's natural height, which is what portfolios, moodboards and mixed-media feeds want.
// CSS columns, so no measuring and no layout thrash.
export default function Masonry({ children, items, renderItem, columns = 3, gap = '1rem', className }) {
  const nodes = items ? items.map((it, i) => (renderItem ? renderItem(it, i) : it)) : children
  const cols = { 2: 'sm:columns-2', 3: 'sm:columns-2 lg:columns-3', 4: 'sm:columns-2 lg:columns-4' }
  return (
    <div className={cx('columns-1', cols[columns] || cols[3], className)} style={{ columnGap: gap }}>
      {/* break-inside-avoid stops an item being split across two columns, which is the one thing CSS columns
          get wrong for card content. */}
      {Array.isArray(nodes)
        ? nodes.map((n, i) => <div key={i} className="mb-4 break-inside-avoid" style={{ marginBottom: gap }}>{n}</div>)
        : nodes}
    </div>
  )
}

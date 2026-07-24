import { Bath, BedDouble, Car, Maximize, Trees, Wifi } from 'lucide-react'
import { cx } from '../lib/cx.js'

// PropertyFeatures — the beds/baths/area icon row every listing needs. Known keys get an icon automatically;
// anything else falls back to a plain label, so a page never has to import icons for this.
const ICONS = { beds: BedDouble, baths: Bath, area: Maximize, parking: Car, garden: Trees, wifi: Wifi }
const LABELS = { beds: 'bed', baths: 'bath', area: '', parking: 'parking', garden: 'garden', wifi: 'wi-fi' }

export default function PropertyFeatures({ features = {}, items, size = 'md', className }) {
  const list = items || Object.entries(features).map(([key, value]) => ({ key, value }))
  const text = size === 'sm' ? 'text-xs' : 'text-sm'
  const icon = size === 'sm' ? 14 : 16
  return (
    <ul className={cx('flex flex-wrap items-center gap-x-5 gap-y-2', text, className)}>
      {list.map((f, i) => {
        const Icon = f.icon || ICONS[f.key]
        const suffix = f.label !== undefined ? f.label : LABELS[f.key]
        const plural = suffix && Number(f.value) !== 1 ? `${suffix}s` : suffix
        return (
          <li key={i} className="inline-flex items-center gap-1.5 text-ink-600">
            {Icon ? <Icon size={icon} className="shrink-0 text-ink-400" aria-hidden="true" /> : null}
            <span className="font-medium tabular-nums text-ink-800">{f.value}</span>
            {plural && <span>{plural}</span>}
          </li>
        )
      })}
    </ul>
  )
}

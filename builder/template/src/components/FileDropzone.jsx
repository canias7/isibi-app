import { useRef, useState } from 'react'
import { File, Upload, X } from 'lucide-react'
import { cx } from '../lib/cx.js'

// FileDropzone — drag-and-drop for ANY file type, with a named list rather than thumbnails. ImageUploader is
// the photo-set version where seeing the picture is the point; this is for CVs, contracts, spreadsheets,
// evidence — where the filename and size are what matter.
const human = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b > 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`)

export default function FileDropzone({
  value = [], onChange, accept, multiple = true, maxSizeMb = 10, max = 5,
  label = 'Attachments', hint, className,
}) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState(null)
  const room = Math.max(0, max - value.length)

  const add = (list) => {
    if (!onChange) return
    const picked = Array.from(list || [])
    const tooBig = picked.find((f) => f.size > maxSizeMb * 1048576)
    if (tooBig) { setError(`${tooBig.name} is larger than ${maxSizeMb} MB.`); return }
    setError(null)
    onChange([...value, ...picked.slice(0, room).map((file, i) => ({ id: `${file.name}-${file.size}-${value.length + i}`, name: file.name, size: file.size, file }))])
  }

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-sm font-medium text-ink-700">{label}</p>}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}>
        <button type="button" onClick={() => input.current && input.current.click()} disabled={!room}
          className={cx('flex w-full flex-col items-center gap-1.5 rounded-xl2 border-2 border-dashed py-8 text-sm transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            over ? 'border-brand-400 bg-brand-50'
              : room ? 'border-ink-200 bg-ink-50/40 text-ink-500 hover:bg-ink-100/60 hover:text-ink-700'
              : 'cursor-not-allowed border-ink-100 text-ink-300')}>
          <Upload size={20} />
          <span className="font-medium">{room ? 'Drop files here, or browse' : `Maximum of ${max} files`}</span>
          {room > 0 && <span className="text-xs text-ink-400">{hint || `Up to ${maxSizeMb} MB each`}</span>}
        </button>
        <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only"
          onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p>}
      {value.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
          {value.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <File size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-400">{human(f.size || 0)}</span>
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== f.id))} aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded-md p-1 text-ink-400 transition hover:bg-ink-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

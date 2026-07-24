import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { cx } from '../lib/cx.js'

// ImageUploader — drag-and-drop image picking with live previews and remove. FileInput is the generic
// any-file control; this one is for photo sets (listings, products, galleries, avatars) where seeing the
// thumbnails IS the interaction.
// value: [{id, url, name, file}] — the caller owns the array so it can upload on submit.
export default function ImageUploader({
  value = [], onChange, max = 8, accept = 'image/*', label = 'Photos',
  hint = 'PNG or JPG, up to 8 images. Drag to add.', className,
}) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const room = Math.max(0, max - value.length)

  const add = (fileList) => {
    if (!onChange) return
    const picked = Array.from(fileList || []).filter((f) => f.type.startsWith('image/')).slice(0, room)
    if (!picked.length) return
    onChange([...value, ...picked.map((file, i) => ({
      // A blob URL renders instantly with no upload round-trip; revoke on remove so we don't leak.
      id: `${file.name}-${file.size}-${value.length + i}`,
      url: URL.createObjectURL(file), name: file.name, file,
    }))])
  }
  const remove = (id) => {
    const gone = value.find((v) => v.id === id)
    if (gone && gone.url && gone.url.startsWith('blob:')) { try { URL.revokeObjectURL(gone.url) } catch {} }
    onChange && onChange(value.filter((v) => v.id !== id))
  }

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-sm font-medium text-ink-700">{label}</p>}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={cx('rounded-xl2 border-2 border-dashed p-4 transition',
          over ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50/40')}>
        {value.length > 0 && (
          <ul className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {value.map((img) => (
              <li key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-ink-100">
                <img src={img.url} alt={img.name || ''} className="h-full w-full object-cover" />
                <button type="button" onClick={() => remove(img.id)} aria-label={`Remove ${img.name || 'image'}`}
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink-900/70 text-canvas opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => input.current && input.current.click()} disabled={!room}
          className={cx('flex w-full flex-col items-center gap-1.5 rounded-xl py-6 text-sm transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            room ? 'text-ink-500 hover:bg-ink-100/70 hover:text-ink-700' : 'cursor-not-allowed text-ink-300')}>
          <ImagePlus size={20} />
          <span className="font-medium">{room ? 'Add images' : `Maximum of ${max} reached`}</span>
          {room > 0 && <span className="text-xs text-ink-400">{hint}</span>}
        </button>
        <input ref={input} type="file" accept={accept} multiple className="sr-only"
          onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
    </div>
  )
}

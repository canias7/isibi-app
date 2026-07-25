import { useRef, useState } from 'react'
import { Upload, File as FileIcon, X } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface FileInputProps {
  label?: ReactNode
  accept?: any
  multiple?: boolean
  onChange?: (...args: any[]) => any
  hint?: ReactNode
  className?: string
}

export default function FileInput({ label, accept, multiple = false, onChange, hint, className }: FileInputProps) {
  const ref = useRef<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [over, setOver] = useState(false)

  const take = (list) => {
    const arr = (Array.from(list || []) as any[])
    setFiles(arr)
    if (onChange) onChange(multiple ? arr : arr[0] || null)
  }

  return (
    <div className={className}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
        onClick={() => ref.current && ref.current.click()}
        className={cx(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition',
          over ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50/50 hover:border-ink-300'
        )}
      >
        <Upload size={20} className="text-ink-400" />
        <span className="text-sm text-ink-600">
          <span className="font-medium text-brand-600">Choose a file</span> or drag it here
        </span>
        {hint && <span className="text-xs text-ink-400">{hint}</span>}
        <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
          onChange={(e) => take(e.target.files)} />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
              <FileIcon size={14} className="text-ink-400" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`}
                onClick={(e) => { e.stopPropagation(); const next = files.filter((_, j) => j !== i); setFiles(next); onChange && onChange(multiple ? next : null) }}
                className="text-ink-400 hover:text-rose-600">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

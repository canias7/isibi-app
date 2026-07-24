import { useState } from 'react'
import { Globe, Image as ImageIcon, Lock, Smile, Users, X } from 'lucide-react'
import Avatar from './Avatar.tsx'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'

// PostComposer — write a public post with media and an audience. ChatComposer is a one-line DM input; this is
// the multi-line social one, with attachments, an audience picker and a character budget.
const AUDIENCE = { public: { label: 'Anyone', icon: Globe }, members: { label: 'Members', icon: Users }, private: { label: 'Only me', icon: Lock } }

interface PostComposerProps {
  author?: any
  avatar?: string
  onPost?: (...args: any[]) => any
  busy?: boolean
  placeholder?: string
  maxLength?: number
  audiences?: any[]
  onEmoji?: (...args: any[]) => any
  className?: string
}

export default function PostComposer({
  author, avatar, onPost, busy = false, placeholder = 'What would you like to share?',
  maxLength = 500, audiences = ['public', 'members'], onEmoji, className,
}: PostComposerProps) {
  const [text, setText] = useState('')
  const [media, setMedia] = useState<any[]>([])
  const [audience, setAudience] = useState(audiences[0])
  const left = maxLength - text.length
  const over = left < 0
  const ready = text.trim().length > 0 && !over && !busy
  const addMedia = (files) => setMedia((m) => [...m, ...(Array.from(files || []) as any[]).slice(0, 4 - m.length)
    .map((f, i) => ({ id: `${f.name}-${i}`, url: URL.createObjectURL(f), name: f.name, file: f }))])
  const drop = (id) => setMedia((m) => {
    const gone = m.find((x) => x.id === id)
    if (gone) { try { URL.revokeObjectURL(gone.url) } catch {} }
    return m.filter((x) => x.id !== id)
  })
  const post = () => {
    if (!ready) return
    onPost && onPost({ text: text.trim(), media, audience })
    setText(''); setMedia([])
  }
  return (
    <div className={cx('card-surface p-4', className)}>
      <div className="flex gap-3">
        <Avatar name={author} src={avatar} size="md" />
        <div className="min-w-0 flex-1">
          <textarea value={text} onChange={(e) => setText((e.target as any).value)} rows={3} placeholder={placeholder} aria-label={String(placeholder ?? "")}
            className="w-full resize-none bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
          {media.length > 0 && (
            <ul className="mt-2 grid grid-cols-4 gap-2">
              {media.map((m) => (
                <li key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-ink-100">
                  <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => drop(m.id)} aria-label={`Remove ${m.name}`}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink-900/70 text-canvas opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none">
                    <X size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        <label className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600 focus-within:ring-2 focus-within:ring-brand-500">
          <ImageIcon size={17} />
          <span className="sr-only">Add photos</span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addMedia(e.target.files); (e.target as any).value = '' }} />
        </label>
        {onEmoji && (
          <button type="button" onClick={onEmoji} aria-label="Add an emoji"
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Smile size={17} />
          </button>
        )}
        {audiences.length > 1 && (
          <select value={audience} onChange={(e) => setAudience((e.target as any).value)} aria-label="Who can see this"
            className="rounded-lg border border-ink-200 bg-surface px-2 py-1 text-xs font-medium text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {audiences.map((a) => <option key={a} value={a}>{(AUDIENCE[a] || {}).label || a}</option>)}
          </select>
        )}
        <span className={cx('ml-auto text-xs tabular-nums', over ? 'font-medium text-rose-600' : left < 40 ? 'text-amber-600' : 'text-ink-400')}>
          {left}
        </span>
        <Button size="sm" onClick={post} disabled={!ready}>{busy ? 'Posting…' : 'Post'}</Button>
      </div>
    </div>
  )
}

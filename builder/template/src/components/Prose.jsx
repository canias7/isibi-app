import { cx } from '../lib/cx.js'

// Prose — the typography wrapper for long-form body copy: articles, docs, terms, changelogs.
// Tailwind's typography plugin isn't installed, so the rules live here as descendant selectors.
// Wrap raw JSX content, or pass `html` for server/markdown-rendered strings.
export default function Prose({ children, html, size = 'md', className }) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }
  const rules = cx(
    'max-w-[68ch] leading-relaxed text-ink-700', sizes[size],
    '[&>*+*]:mt-5',
    '[&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink-900 [&_h2]:mt-10 [&_h2]:scroll-mt-24',
    '[&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-900 [&_h3]:mt-8 [&_h3]:scroll-mt-24',
    '[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-700',
    '[&_strong]:font-semibold [&_strong]:text-ink-900',
    '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mt-2 [&_li]:pl-1',
    '[&_blockquote]:border-l-2 [&_blockquote]:border-brand-300 [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-ink-600',
    '[&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.875em] [&_code]:text-ink-800',
    '[&_img]:rounded-xl2 [&_img]:w-full',
    '[&_hr]:border-ink-100',
    '[&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:border-ink-200 [&_th]:py-2 [&_th]:text-left [&_td]:border-b [&_td]:border-ink-100 [&_td]:py-2',
    className,
  )
  if (html) return <div className={rules} dangerouslySetInnerHTML={{ __html: html }} />
  return <div className={rules}>{children}</div>
}

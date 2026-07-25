import { Award, Download, ExternalLink } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface CertificateCardProps {
  recipient?: any
  course?: any
  issuer?: any
  issuedOn?: any
  credentialId?: any
  verifyHref?: any
  onDownload?: (...args: any[]) => any
  expires?: any
  className?: string
}

// CertificateCard — the completion certificate: awarded-to, course, date, credential id, verify link.
// Styled as a document rather than an app card, because that is what it is.
export default function CertificateCard({
  recipient, course, issuer, issuedOn, credentialId, verifyHref, onDownload, expires, className,
}: CertificateCardProps) {
  return (
    <div className={cx('relative overflow-hidden rounded-xl2 border-2 border-brand-200 bg-surface p-8 text-center', className)}>
      {/* A soft corner wash instead of clip-art — it reads as printed stock without a background image. */}
      <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-50" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-50" aria-hidden="true" />
      <div className="relative">
        <Award size={32} className="mx-auto text-brand-500" aria-hidden="true" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">Certificate of completion</p>
        <p className="mt-6 text-sm text-ink-500">This certifies that</p>
        <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-900">{recipient}</p>
        <p className="mt-4 text-sm text-ink-500">has successfully completed</p>
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{course}</p>
        <dl className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-ink-100 pt-5 text-xs">
          {issuer && <div><dt className="text-ink-400">Issued by</dt><dd className="mt-0.5 font-medium text-ink-700">{issuer}</dd></div>}
          {issuedOn && <div><dt className="text-ink-400">Date</dt><dd className="mt-0.5 font-medium tabular-nums text-ink-700">{issuedOn}</dd></div>}
          {expires && <div><dt className="text-ink-400">Expires</dt><dd className="mt-0.5 font-medium tabular-nums text-ink-700">{expires}</dd></div>}
          {credentialId && <div><dt className="text-ink-400">Credential ID</dt><dd className="mt-0.5 font-mono text-ink-700">{credentialId}</dd></div>}
        </dl>
        {(onDownload || verifyHref) && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {onDownload && (
              <button type="button" onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-brandfg transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <Download size={15} />Download PDF
              </button>
            )}
            {verifyHref && (
              <a href={verifyHref} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                Verify <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

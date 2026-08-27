import { SafeImage } from "@/components/ui/safe-image";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Who is billing whom, for what, and by when.
 *
 * Both addresses are `<address>` elements — the tag exists for exactly this
 * and is what lets a parser tell the two apart from the surrounding text.
 * Everything is optional except the number: a sole trader's invoice has no
 * logo and no VAT line, and one that renders empty boxes for them looks
 * broken rather than simple.
 */
export function InvoiceHeader({ number, issuedAt, dueAt, from, to, logo, reference, className }: {
  number: string; issuedAt?: string | number | Date; dueAt?: string | number | Date;
  from?: { name: string; lines?: string[]; vat?: string };
  to?: { name: string; lines?: string[] };
  logo?: string | null; reference?: string; className?: string;
}) {
  return (
    <header data-slot="invoice-header" className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {logo && <SafeImage src={logo} alt="" className="mb-3 h-10 w-auto object-contain" />}
          <h1 className="text-xl font-semibold">Invoice</h1>
          <p className="font-mono text-sm text-muted-foreground">{number}</p>
        </div>
        <dl className="text-sm">
          {issuedAt && <div className="flex justify-end gap-3">
            <dt className="text-muted-foreground">Issued</dt><dd><DateFormat date={issuedAt} /></dd></div>}
          {dueAt && <div className="flex justify-end gap-3">
            <dt className="text-muted-foreground">Due</dt><dd className="font-medium"><DateFormat date={dueAt} /></dd></div>}
          {reference && <div className="flex justify-end gap-3">
            <dt className="text-muted-foreground">Reference</dt><dd>{reference}</dd></div>}
        </dl>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {from && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
            <address className="mt-1 text-sm not-italic">
              <span className="font-medium">{from.name}</span>
              {from.lines?.map((l) => <span key={l} className="block text-muted-foreground">{l}</span>)}
              {from.vat && <span className="mt-1 block text-muted-foreground">VAT {from.vat}</span>}
            </address>
          </div>
        )}
        {to && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
            <address className="mt-1 text-sm not-italic">
              <span className="font-medium">{to.name}</span>
              {to.lines?.map((l) => <span key={l} className="block text-muted-foreground">{l}</span>)}
            </address>
          </div>
        )}
      </div>
    </header>
  );
}

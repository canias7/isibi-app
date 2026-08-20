// manufacturer /stockists — where to buy without an account. "Find distributor"
// is one of this family's own CTAs: small orders go through the counter or a
// stockist, and sending a five-box buyer into the RFQ pipeline wastes both
// ends of the phone.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { StoreLocator } from "@/components/ui/store-locator";
export const Route = createFileRoute("/stockists")({ component: P });
const CHROME = {
  name: "Attercliffe Fastenings", tagline: "Cold-forged fasteners since 1953. BS EN ISO 898-1.",
  links: [{ label: "Home", href: "/" }, { label: "The 12.9 line", href: "/product" }, { label: "Stockists", href: "/stockists" }],
  action: { label: "Request quote", href: "/quote" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Where to buy by the box</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Under a thousand pieces, a stockist is faster and we'd rather you used one — every counter below holds the common metrics in 8.8 and 10.9. Full 12.9 range is ours and Leeds's only.</p>
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">Our own counter</h2>
          <StoreLocator className="mt-1" onDirections={() => {}} stores={[
            { id: 0, name: "Attercliffe Fastenings — trade counter", address: "Warhurst Road, Sheffield S9 3TR", distance: "the source", open: true, hoursNote: "7:30–4:30 weekdays · full range incl. 12.9", phone: "0114 244 1953" },
          ]} />
        </section>
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">Stockists, nearest first</h2>
          <StoreLocator className="mt-1" onDirections={() => {}} stores={[
            { id: 1, name: "Don Valley Fixings", address: "Newhall Road, Sheffield S9 2QL", distance: "1.2 mi", open: true, hoursNote: "8.8 and 10.9 full range", phone: "0114 243 8871" },
            { id: 2, name: "Pennine Bolt Co.", address: "Bradford Road, Huddersfield HD1 6PW", distance: "22 mi", open: true, hoursNote: "8.8 · zinc and galv" },
            { id: 3, name: "Aire Fasteners", address: "Whitehall Road, Leeds LS12 1BE", distance: "31 mi", open: false, hoursNote: "Opens 7:00 · stocks 12.9", phone: "0113 244 0021" },
            { id: 4, name: "Trent Industrial Supplies", address: "Colwick Loop Road, Nottingham NG4 2JT", distance: "38 mi", open: true, hoursNote: "8.8 core sizes" },
          ]} />
        </section>
        <p className="mt-8 rounded-xl border bg-muted/40 p-4 text-sm">A stockist out of your size will ring us and have it next day — or skip the middle leg: <a className="font-medium underline underline-offset-4" href="/quote">a schedule over a thousand pieces is quote territory</a> and ships direct.</p>
      </div>
    </SiteChrome>
  );
}

// printer /products — stocks, finishes and sizes, with SIZES EXPRESSED AS
// THINGS PEOPLE CAN PICTURE.
//
// "A1" MEANS NOTHING TO MOST CUSTOMERS and A0 means less. Everybody in the
// trade forgets this, prints a table of millimetres, and then spends the phone
// call describing a poster with their hands. Held against a shop window, a
// noticeboard or a site fence, the size chooses itself.
//
// STOCK WEIGHTS ARE THE SAME PROBLEM. 400gsm versus 350gsm is a number nobody
// outside a print room can feel, so each one says what it is LIKE and what it
// is for.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SizeGuide } from "@/components/ui/size-guide";
import { PriceList } from "@/components/ui/price-list";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { TurnaroundNote } from "@/components/ui/turnaround-note";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/products")({ component: P });

const RAIL = [
  { name: "Business cards", href: "#cards" },
  { name: "Flyers and leaflets", href: "#flyers" },
  { name: "Posters", href: "#posters" },
  { name: "Roller banners", href: "#banners" },
  { name: "Correx site boards", href: "#correx" },
  { name: "Vinyl lettering", href: "#vinyl" },
  { name: "Stickers and labels", href: "#stickers" },
  { name: "T-shirts and workwear", href: "#garments" },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Print & Sign"
      tagline="Every stock, every finish, and what each size actually looks like."
      links={[
        { label: "Prices", href: "/" },
        { label: "Send artwork", href: "/quote" },
      ]}
      action={{ label: "Send artwork", href: "/quote" }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[15rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">On this page</p>
          <nav className="mt-4">
            <ul className="divide-y divide-border border-y border-border">
              {RAIL.map((r) => (
                <li key={r.name}>
                  <a className="block py-3 text-sm" href={r.href}>{r.name}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-6">
            <TurnaroundNote from={3} to={5} busyNote="Correx at 7–8 days until mid-September" />
          </div>
          <a className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="/quote">
            Send artwork
          </a>
        </aside>

        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">Products</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Sizes are given as things you can hold up against a wall, because A1 is a number nobody
            outside a print room can picture and describing a poster over the phone with your hands
            is how half our enquiries used to go.
          </p>

          {/* WHAT THE STOCK LOOKS LIKE, WHICH IS THE ONLY THING A WEIGHT IN
              GSM CANNOT SAY. "400gsm matt" is a number nobody outside a print
              room can feel; a photograph of the edge of the card next to a
              350gsm one is the same fact in a form a customer can use. Every
              caption here is a fact rather than a mood, for the same reason. */}
          <section className="mt-10">
            <MediaGrid
              columns={4}
              ratio="4/3"
              items={[
                { src: null, alt: "Four card stocks fanned on the bench, edges toward the camera", caption: "350 · 400 · 450 soft-touch · 540 duplex, edge on." },
                { src: null, alt: "A5 flyers coming off the guillotine in a lift", caption: "170gsm silk. The commonest job in the building." },
                { src: null, alt: "A roller banner stood up in the unit against a white wall", caption: "800 × 2000mm, cassette base, panel replaceable." },
                { src: null, alt: "A transit van half-liveried, vinyl squeegee mid-stroke", caption: "Cut vinyl on a plain van. One day in the unit." },
              ]}
            />
          </section>

          {/* SIZES AS FURNITURE. The one thing a millimetre table cannot do. */}
          <section id="posters" className="mt-12">
            <SectionHeader
              eyebrow="Posters and boards"
              title="How big is each of these, really"
              description="Printed on 200gsm satin indoors, or 4mm correx and weatherproof vinyl outdoors. Prices are for one — they fall about a third at ten."
            />
            <div className="mt-8">
              <SizeGuide
                caption="Held against something you already own"
                sizes={[
                  {
                    name: "A0",
                    area: 9992,
                    areaLabel: "841 × 1189mm",
                    like: "Taller than a kitchen worktop and nearly as wide as a door. A trade-stand backdrop, or a shop window fill.",
                    alsoFits: ["Read from thirty metres", "Two people to hang it"],
                    price: "£46",
                  },
                  {
                    name: "A1",
                    area: 4996,
                    areaLabel: "594 × 841mm",
                    like: "About a café A-board panel. This is the one people mean when they say 'a big poster'.",
                    alsoFits: ["Read comfortably from ten metres", "Fits a standard snap frame"],
                    price: "£24",
                  },
                  {
                    name: "A2",
                    area: 2498,
                    areaLabel: "420 × 594mm",
                    like: "A supermarket noticeboard card. Big enough to read across a room, small enough to post.",
                    alsoFits: ["Gig posters", "Village hall noticeboards"],
                    price: "£14",
                  },
                  {
                    name: "A3",
                    area: 1249,
                    areaLabel: "297 × 420mm",
                    like: "Two sheets of printer paper side by side. A window card, a menu board, a price list.",
                    alsoFits: ["Shop window from the pavement", "Laminated for a kitchen"],
                    price: "£6",
                  },
                  {
                    name: "8ft × 4ft correx",
                    area: 29729,
                    areaLabel: "2440 × 1220mm",
                    like: "A full sheet of plywood. This is a site hoarding or a field sign and it needs two fixings a side.",
                    alsoFits: ["Read from a moving car", "Cable-tied to Heras fencing"],
                    price: "£58",
                  },
                ]}
              />
            </div>
          </section>

          <section id="cards" className="mt-14">
            <SectionHeader
              eyebrow="Business cards"
              title="Four stocks, and what each one feels like"
              description="All 85 × 55mm unless you ask otherwise, printed both sides, and the price is the same either way — a blank back costs what a printed one costs."
            />
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <SpecList>
                <SpecRow label="350gsm silk" value="Standard" note="What most cards are. Fine, unremarkable, and cheap. Takes a pen." />
                <SpecRow label="400gsm matt" value="Our default" highlight note="Noticeably stiffer in the hand and it is what people mean by 'a good card'. Takes a pen." />
                <SpecRow label="450gsm soft-touch" value="+£14 per 500" note="Velvety, fingerprints a bit, and it does not take a pen at all. Beautiful and impractical for a tradesman." />
                <SpecRow label="540gsm duplex" value="+£38 per 500" note="Two sheets bonded, often with a coloured core. Architects and tattooists. Genuinely lovely." />
              </SpecList>
              <SpecList>
                <SpecRow label="Matt lamination" value="+£9 per 500" note="Scuff-resistant, slightly softer look. Recommended on anything dark." />
                <SpecRow label="Gloss lamination" value="+£9 per 500" note="Shows fingerprints on dark colours. Good on photographs." />
                <SpecRow label="Spot UV" value="+£40 per 500" note="Gloss varnish on part of the design only. Needs a second file marking where — we will explain." />
                <SpecRow label="Rounded corners" value="+£12 per 500" note="3mm radius. Looks deliberate rather than worn." />
                <SpecRow label="Minimum" value="50" note="A digital job. 50 and 100 cost the same £18, and we will tell you that rather than take the smaller order." />
              </SpecList>
            </div>
          </section>

          <section id="flyers" className="mt-14">
            <SectionHeader
              eyebrow="Flyers, leaflets and menus"
              title="Flat, folded, and the fold nobody knows the name of"
              description="Prices are per 1,000 on 170gsm silk. Folding adds about £14 per thousand whichever fold it is."
            />
            <div className="mt-6">
              <PriceList
                items={[
                  { name: "A6 flat", description: "Postcard size. Letterbox drops and till-point takeaways.", price: 54, meta: "per 1,000" },
                  { name: "A5 flat", description: "The default. Half a sheet of A4 and the size of most leaflets you have been handed.", price: 78, meta: "per 1,000" },
                  { name: "A4 flat", description: "Price lists, one-page menus, service sheets.", price: 126, meta: "per 1,000" },
                  { name: "A4 folded to A5", description: "A four-page leaflet. The commonest menu format there is.", price: 140, meta: "per 1,000" },
                  { name: "A4 roll-fold to DL", description: "Three panels, folds into an envelope. What people mean by 'a trifold'.", price: 148, meta: "per 1,000" },
                  { name: "DL flat", description: "Long and thin, 99 × 210mm. Fits a standard envelope without folding.", price: 66, meta: "per 1,000" },
                  { name: "Laminated menu, A4", description: "250gsm, gloss both sides, wipe-clean. Priced per 100 because nobody wants a thousand.", price: 68, meta: "per 100" },
                ]}
              />
            </div>
          </section>

          <section id="banners" className="mt-14">
            <SectionHeader
              eyebrow="Banners and signs"
              title="The outdoor half"
              description="Everything here is UV-stable for at least three years outdoors, and we will say so when something is not — cheap banner ink fades to pink in one summer and that is where the trade gets its bad name."
            />
            <div className="mt-6">
              <PriceList
                items={[
                  { name: "Roller banner, 800 × 2000mm", description: "Cassette base, printed panel, carry bag included. Panel-only replacement £34.", price: 68 },
                  { name: "Roller banner, 1000 × 2000mm", description: "The wider one. Worth it if there is text either side of a logo.", price: 82 },
                  { name: "PVC banner, per m²", description: "540gsm, hemmed, eyelets every 500mm. Minimum 2m².", price: 26, meta: "per m²" },
                  { name: "Mesh banner, per m²", description: "Perforated so wind passes through. Scaffolding and fences — a solid banner on a fence becomes a sail.", price: 34, meta: "per m²" },
                  { name: "Foamex panel, 5mm, per m²", description: "Rigid, light, indoor or sheltered. Drilled and countersunk free.", price: 48, meta: "per m²" },
                  { name: "Dibond panel, 3mm, per m²", description: "Aluminium composite. Fifteen years outdoors and it does not warp. What a permanent shop sign should be.", price: 96, meta: "per m²" },
                ]}
              />
            </div>
          </section>

          <section id="vinyl" className="mt-14">
            <SectionHeader
              eyebrow="Vinyl and vehicles"
              title="Cut lettering, wraps and van livery"
              description="Fitting is included in every price here and it is not an optional extra we quietly add. A survey first is free and takes twenty minutes."
            />
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <SpecList>
                <SpecRow label="Window lettering" value="£84" unit="per m², fitted" note="Cut vinyl. Seven-year outdoor film as standard." />
                <SpecRow label="Frosted privacy film" value="£64" unit="per m², fitted" note="Plain or with a cut logo. Offices and treatment rooms." />
                <SpecRow label="Van, small panel set" value="£320" note="Both doors and the rear. One day in the unit." />
                <SpecRow label="Van, half wrap" value="£690" note="Lower two thirds plus rear. Two days." />
                <SpecRow label="Van, full wrap" value="£1,850" note="Printed film, laminated. Three days, and it comes off cleanly in five years." />
              </SpecList>
              <SpecList>
                <SpecRow label="Chapter 8 kit" value="£240" unit="fitted" note="Red and yellow chevrons to the standard. Required on a lot of contracts and the spec is not optional." />
                <SpecRow label="Magnetic panels, pair" value="£78" note="For a leased van you cannot stick anything to. 600 × 400mm." />
                <SpecRow label="Removal, per panel" value="£45" note="Old livery off. Heat and patience — the price is the hour, not the vinyl." />
                <SpecRow label="Survey" value="Free" highlight note="We come to the van or the shop front and measure. Nobody should be guessing at a wrap." />
              </SpecList>
            </div>
          </section>

          <section id="stickers" className="mt-14">
            <SectionHeader
              eyebrow="Stickers, labels and garments"
              title="The small runs"
              description="Both are quantity games like flyers, and both have a hard minimum where the setup dominates."
            />
            <div className="mt-6">
              <PriceList
                items={[
                  { name: "Kiss-cut vinyl stickers, 50mm", description: "On sheets. 100 minimum. Dishwasher-safe laminate included.", price: 42, meta: "per 250" },
                  { name: "Roll labels, 60mm round", description: "For jars and boxes, on a roll for an applicator. 500 minimum.", price: 58, meta: "per 500" },
                  { name: "Waterproof outdoor decals", description: "Cut to shape, three-year film. Priced per m² of material used.", price: 74, meta: "per m²" },
                ]}
              />
            </div>
            <div id="garments" className="mt-8">
              <PriceList
                items={[
                  { name: "T-shirt, one colour front, screen printed", description: "Over 25 pieces. The screen setup is £22 a colour and is where the minimum comes from.", price: 7.4, meta: "each, 25+" },
                  { name: "T-shirt, DTF transfer", description: "Under 25, full colour, no setup. One shirt is fine and costs £14.", price: 11, meta: "each, 1–24" },
                  { name: "Polo, embroidered left breast", description: "Digitising the logo is £28 once, then it is on file forever.", price: 15.5, meta: "each, 10+" },
                  { name: "Hi-vis, printed back", description: "Company name across the shoulders. The standard workwear job.", price: 13, meta: "each, 10+" },
                  { name: "Hoodie, embroidered", description: "Front logo and a back name. Leavers' hoodies from 15 pieces.", price: 26, meta: "each, 15+" },
                ]}
              />
            </div>
          </section>

          <section id="correx" className="mt-14">
            <SectionHeader title="Product questions" />
            <div className="mt-6">
              <Faq
                items={[
                  {
                    question: "Which stock should I pick for cards?",
                    answer:
                      "400gsm matt for almost everybody. It is what people mean by a good card, it takes a pen, and it costs about £4 more per 500 than the thin one. Soft-touch feels wonderful and cannot be written on, which matters more than people expect.",
                  },
                  {
                    question: "Will the colour match my last batch?",
                    answer:
                      "If it was printed here, yes — we keep the file and the press profile. If it was printed elsewhere, close but not identical, and we will say so up front. Send us a sample and we will match it as near as CMYK allows.",
                  },
                  {
                    question: "Can I supply my own garments?",
                    answer:
                      "Yes, and about a third of people do. We will not be liable for a shirt we did not sell if a print goes wrong, which happens perhaps twice a year, so bring a spare.",
                  },
                  {
                    question: "Is any of it recyclable?",
                    answer:
                      "Uncoated and silk paper, yes. Laminated card, no — the plastic film cannot be separated, which is worth knowing before you laminate 5,000 flyers. Correx is recyclable in theory and almost nowhere in practice.",
                  },
                ]}
              />
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              <a className="underline underline-offset-4" href="/">Quantity breaks and prices</a>
              {" · "}
              <a className="underline underline-offset-4" href="/quote">Send artwork</a>
            </p>
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}

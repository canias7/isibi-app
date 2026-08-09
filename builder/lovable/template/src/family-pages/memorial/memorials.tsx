// memorial /memorials — the work, with materials and WHAT EACH COSTS TO
// MAINTAIN.
//
// A MEMORIAL IS BOUGHT ONCE AND LOOKED AFTER FOR FIFTY YEARS. Polished black
// granite stays sharp and shows every water mark; Yorkshire sandstone weathers
// beautifully and the lettering softens within thirty years. Nobody is told
// either of those at the point of choosing, and both are more consequential
// than the price.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/memorials")({ component: P });

const STONE = [
  { name: "Yorkshire sandstone", life: "Softens gently. Lettering readable at 60 years, faint by 100", care: "Nothing. Do not clean it — the lichen is part of it and a pressure washer destroys the face.", note: "Quarried at Crosland Hill. Local, and it is what most of the older stones here are." },
  { name: "Grey Rustenburg granite", life: "Essentially permanent. Lettering as cut in 200 years", care: "Rinse with water once a year. Nothing else, ever.", note: "The commonest choice. Hard-wearing and it does not show water marks." },
  { name: "Polished black granite", life: "Permanent, and every mark shows", care: "Wipe monthly if you want it to look as it did. Water marks, pollen and bird lime all show badly.", note: "Striking when new and it needs the most looking after. Refused in several churchyards." },
  { name: "Portland stone", life: "Weathers to a soft grey. Lettering good for 80 years", care: "Nothing. It self-cleans in rain and streaks if you wash it.", note: "What the war graves are cut from. Quiet and it ages very well." },
  { name: "Slate, Welsh or Cumbrian", life: "Permanent. Takes the finest lettering of any stone", care: "Nothing. It is unaffected by anything the weather does.", note: "The best surface for hand-cut lettering and the most expensive to letter because of it." },
];

const PRICES = [
  { name: "Small granite tablet, 300×300", description: "For a cremation plot or a garden of remembrance", price: 620 },
  { name: "Headstone, granite, 600×750 on a base", description: "The commonest memorial. Includes the base and fixing", price: 1450 },
  { name: "Headstone, Yorkshire sandstone, hand-cut", description: "Local stone, hand lettering rather than sandblast", price: 2650 },
  { name: "Full kerbed memorial", description: "Where the cemetery permits one. Headstone, kerbs and chippings", price: 3400 },
  { name: "Lettering, sandblast", description: "Per letter, including gilding or painting", price: 4.4, meta: "a letter" },
  { name: "Lettering, hand-cut", description: "Per letter. Cut with a mallet and chisel here", price: 11, meta: "a letter" },
  { name: "Adding an inscription later", description: "Done in the cemetery, one day. Includes removing and refixing where needed", price: 480 },
  { name: "Cleaning and re-lettering an old stone", description: "Including re-gilding. Often transforms one completely", price: 390 },
  { name: "Cemetery permit", description: "Sheffield City Council sets it. We apply", price: 142, meta: "at cost" },
];

function P() {
  return (
    <SiteChrome
      name="Hartley & Vane Memorials"
      tagline="The work, the stone, and what each one asks of you afterwards."
      links={[
        { label: "Start here", href: "/" },
        { label: "Guidance", href: "/guidance" },
      ]}
      action={{ label: "Talk to us", href: "tel:01142551104" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">The work</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Cut, dressed and lettered on Abbeydale Road. You are welcome to come and watch it being
          done, and a number of families have found that more useful than anything on a website.
        </p>

        <section className="mt-14">
          <Gallery
            columns={3}
            items={[
              { src: null, alt: "A hand-cut Yorkshire sandstone headstone", caption: "Yorkshire sandstone, hand-cut Roman lettering" },
              { src: null, alt: "Grey granite headstone with a base", caption: "Grey Rustenburg granite, sandblast lettering, gilded" },
              { src: null, alt: "A slate memorial with fine lettering", caption: "Welsh slate. It takes finer lettering than any other stone" },
              { src: null, alt: "A small cremation tablet", caption: "Cremation tablet, 300mm, in the garden of remembrance" },
              { src: null, alt: "A restored Victorian memorial", caption: "An 1889 stone, cleaned and re-lettered. £390" },
              { src: null, alt: "A kerbed memorial in an older section", caption: "Full kerbed set — permitted only in the pre-1975 sections" },
            ]}
          />
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="The stone"
            title="What it will look like in fifty years, and what it asks of you"
            description="This matters more than the price and almost nobody is told it. Polished black is the most striking on the day and the most demanding for the next half century."
          />
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {STONE.map((s) => (
              <li key={s.name} className="py-5">
                <p className="font-medium">{s.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2 md:gap-8">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">In time. </span>{s.life}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Looking after it. </span>{s.care}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr]">
            <div className="lg:pt-6">
              <SectionHeader
                eyebrow="What it costs"
                title="Nine lines, and the permit is at cost"
                description="Everything includes the concrete beam foundation and the fixing. Nobody should be quoted for a stone and then charged separately for putting it in the ground."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Twelve months to pay, interest free, starting whenever you are ready. Cleaning and
                re-lettering an old family stone is £390 and it transforms one — it is the thing we
                would suggest before a new memorial in a lot of cases.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Hand-cut lettering"
                title="Eleven pounds a letter, and worth every one"
                description="Sandblasting is cut through a rubber stencil and it is even and mechanical. Hand-cutting is a mallet and a chisel, and the light catches the V of the cut differently through the day."
              />
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                On a forty-letter inscription the difference is about £260. It is the only upgrade
                on this page we would actively recommend, and it is the reason Victorian stones
                still look like something and modern ones often do not.
              </p>
            </div>
            <SafeImage
              src={null}
              alt="A chisel cutting a Roman capital into sandstone"
              ratio="4/3"
              fallbackSeed="chisel"
            />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Questions about the work" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can we have something unusual?",
                  answer:
                    "Often, within the cemetery's rules. A shape, a carved detail, a line of music, a fingerprint. Bring the idea — the constraint is nearly always the authority's regulations rather than the stone.",
                },
                {
                  question: "How long does the lettering last?",
                  answer:
                    "On granite or slate, as long as the stone. On sandstone it softens and is faint in about a century, which some families find right and others do not. It is worth deciding deliberately.",
                },
                {
                  question: "Can you match an existing family stone?",
                  answer:
                    "Usually. Bring a photograph with something in it for scale. Matching a hundred-year-old sandstone exactly is not possible and getting close is, and we will show you the difference before committing.",
                },
                {
                  question: "What is a guarantee worth here?",
                  answer:
                    "Thirty years on the fixing, which is the part that fails. BRAMM registration means the foundation is to a standard and inspected. Nobody guarantees the stone itself and anybody who does is selling something.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The regulations and the timescale</a>
            {" · "}
            <a className="underline underline-offset-4" href="/guidance">Inscriptions and adding later</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}

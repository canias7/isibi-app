// antiques — EACH-PIECE-UNIQUE: one of everything, so a sold piece stays on
// the page marked sold rather than vanishing.
//
// A DEALER'S SOLD STOCK IS THE ONLY EVIDENCE OF WHAT THEY HANDLE. There is one
// of each thing and it will never come back, so a site that deletes a piece the
// day it sells destroys its own record. Somebody deciding whether to consign a
// Georgian bureau here needs to see that three have gone through.
//
// EDITORIAL, and deliberately not a grid: a wall of equal thumbnails is exactly
// how a unique object stops looking like one.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LotCard } from "@/components/ui/lot-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Vane & Marrow"
      tagline="Furniture, metalware and Sheffield plate. Abbeydale Road, by appointment or by chance."
      links={[
        { label: "A piece in full", href: "#/piece" },
        { label: "Selling something", href: "#/selling" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Enquire", href: "#/piece" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr]">
            <div className="lg:pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Established 1974 · BADA member
              </p>
              <h1 className="mt-4 text-6xl font-semibold leading-[1.03] tracking-tight text-balance">
                One of everything
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Which is the whole difficulty and the whole point. Nothing here comes back, so each
                piece gets its own page rather than a square in a grid — and a piece that sells
                stays on this site, marked sold, because it is the record of what we handle.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Provenance and condition get as much room as the photograph. That is where the
                price actually comes from, and a dealer who shows you only the photograph is
                telling you something by omission.
              </p>
              <a className="mt-8 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/piece">
                A piece described properly
              </a>
            </div>
            <div>
              <SafeImage
                src={null}
                alt="A George III mahogany bureau, open, in the front room of the shop"
                ratio="4/5"
                fallbackSeed="bureau"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                George III mahogany bureau, c.1790, with a fitted interior and the original brass.
                In the front room and available.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader
            eyebrow="Available now"
            title="Nine pieces in the shop"
            description="Priced as they are, with the estimate range where a piece is going to auction instead. We do not do 'price on application'."
          />
          <div className="mt-10 space-y-5">
            <LotCard
              lotNumber="A-441"
              title="George III mahogany bureau, fitted interior"
              maker="Unattributed, probably North Country"
              estimateLow={1800}
              estimateHigh={2400}
              currentBid={1950}
              conditionReportNote="One replaced escutcheon and a repaired lopper. Full report on the piece page."
            />
            <LotCard
              lotNumber="A-438"
              title="Pair of Old Sheffield Plate candlesticks, c.1785"
              maker="Attributed to Tudor & Leader"
              estimateLow={620}
              estimateHigh={800}
              currentBid={740}
              conditionReportNote="Bleeding to the copper at both bases, as expected and not detracting."
            />
            <LotCard
              lotNumber="A-429"
              title="Arts and Crafts oak settle"
              maker="Attributed to the Yorkshire school"
              estimateLow={900}
              estimateHigh={1200}
              hammerPrice={1150}
              premiumPercent={0}
              sold
              conditionReportNote="Sold 22 July to a private buyer in Leeds. Kept here as part of the record."
            />
            <LotCard
              lotNumber="A-417"
              title="Regency rosewood card table"
              estimateLow={1400}
              estimateHigh={1800}
              hammerPrice={1320}
              premiumPercent={0}
              sold
              conditionReportNote="Sold 9 July, under estimate. The veneer lifting on the frieze is why, and it was disclosed."
            />
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The two sold pieces stay because they are evidence. A dealer's cleared stock is the only
            honest answer to "do you actually handle things like mine", and deleting it makes a
            website into a shop window rather than a record.
          </p>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader title="What people ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Are the prices negotiable?",
                  answer:
                    "A little, on a piece that has been here a while, and we will say which those are if you ask. We do not price high to leave room for haggling, so there is less movement than in some shops.",
                },
                {
                  question: "Do you deliver?",
                  answer:
                    "Anywhere in the north at cost, and we use a two-man furniture carrier rather than a courier. Nationally, about £180 for anything up to a chest. We will not post furniture and no honest dealer does.",
                },
                {
                  question: "How do I know it is what you say it is?",
                  answer:
                    "Everything is described in full including the restoration, and BADA membership means a binding code and a route if we get it wrong. Take a piece to another dealer for an opinion before buying — we will hold it for a fortnight.",
                },
                {
                  question: "Can I come and look?",
                  answer:
                    "Thursday to Saturday, 10 to 5, or any other day if you ring first. Somebody is nearly always in the workshop at the back even when the shop looks shut.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}

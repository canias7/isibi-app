// personal-brand/donate-volunteer-split /press — the press kit is the one page
// that survives the variant unchanged in PURPOSE and changes completely in
// CONTENT. A musician's press kit exists so a promoter can lift a bio without
// emailing; a campaign's exists so a local reporter on a deadline can file
// something accurate at four in the afternoon without ringing anybody.
//
// So the same three-lengths-of-bio shape, and then the two things a campaign
// press kit needs that an artist's does not: who the trustees actually are,
// and the documents that back the numbers we quote.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactCard } from "@/components/ui/contact-card";
import { CopyButton } from "@/components/ui/copy-button";
import { DownloadCard } from "@/components/ui/download-card";
import { Gallery } from "@/components/ui/gallery";
import { KeyPoints } from "@/components/ui/key-points";
import { PressQuote } from "@/components/ui/press-quote";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
export const Route = createFileRoute("/press")({ component: P });
const SHORT = "Save Cotton Mill Baths is a community bid to take the Grade II listed 1904 baths on Bury New Road into a charitable trust. It needs £180,000 for the roof and 400 named volunteers by 14 October 2026.";
const MEDIUM = "Save Cotton Mill Baths is a community asset transfer bid for the Grade II listed Edwardian baths on Bury New Road, closed with four days' notice in March 2019 and empty since. The Cotton Mill Baths Trust, a CIO with nine unpaid local trustees, must raise £180,000 for roof works and name 400 volunteers willing to help operate the building before the council's committee decides on 14 October 2026. As of August 2026 it has raised £112,400 from 1,340 donors and named 268 volunteers. A 2023 sale to a developer for fifty-four flats collapsed after the listing made the roof works uneconomic.";
function P() {
  return (
    <SiteChrome name="Save Cotton Mill Baths" tagline="A community bid for the 1904 baths on Bury New Road. Closed 2019. Not demolished yet."
      links={[{ label: "Give or volunteer", href: "#/" }, { label: "Where the money goes", href: "#/music" }]}
      action={{ label: "Give", href: "#/" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="Press" title="Everything, ready to lift, no permission needed"
          description="Use any of it without asking. If you are filing today, ring Rhona on the number at the bottom — she answers, including at the weekend, and she will tell you if a number on this page has moved since it was published." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <SectionHeader eyebrow="The campaign" title="At three lengths" />

            <div className="mt-6 space-y-6">
              <div className="rounded-lg border border-border p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium">One line — 24 words</p>
                  <CopyButton value="A community bid to save the Grade II listed 1904 Cotton Mill Baths, needing £180,000 and 400 volunteers by 14 October." label="Copy" />
                </div>
                <p className="mt-3 text-base leading-relaxed">
                  A community bid to save the Grade II listed 1904 Cotton Mill Baths, needing
                  £180,000 and 400 volunteers by 14 October.
                </p>
              </div>

              <div className="rounded-lg border border-border p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium">A paragraph — 41 words</p>
                  <CopyButton value={SHORT} label="Copy" />
                </div>
                <p className="mt-3 text-base leading-relaxed">{SHORT}</p>
              </div>

              <div className="rounded-lg border border-border p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium">The full note — 116 words</p>
                  <CopyButton value={MEDIUM} label="Copy" />
                </div>
                <p className="mt-3 text-base leading-relaxed">{MEDIUM}</p>
              </div>
            </div>

            <div className="mt-10">
              <SectionHeader eyebrow="The numbers" title="What they are, and where each one comes from"
                description="Every figure we quote has a source you can check. Two of them are surveys we paid for and one of those says something we would rather it did not." />
              <SpecList className="mt-6">
                <SpecRow label="Raised" value="£112,400" note="From 1,340 donors. Updated the day it changes, not weekly" highlight />
                <SpecRow label="Target" value="£180,000" note="Roof only. Wallace & Kerr structural survey, May 2026, published below" highlight />
                <SpecRow label="Volunteers named" value="268 of 400" note="400 is the council's condition, not our target" highlight />
                <SpecRow label="Median gift" value="£25" note="Largest £5,000, smallest £2" />
                <SpecRow label="Closed" value="March 2019" note="Four days' notice, plant room leak. Council minutes, 26 Feb 2019" />
                <SpecRow label="Listed" value="Grade II, Nov 2020" note="Historic England list entry 1478822" />
                <SpecRow label="Reopening the pool" value="A further £1.1m" note="Not part of this bid and we have never said it was" />
                <SpecRow label="Trustees" value="Nine, unpaid" note="Named below. Two are former councillors and say so" />
              </SpecList>
            </div>

            <div className="mt-10">
              <SectionHeader eyebrow="Quotes" title="Cleared for use, attributed as written" />
              <div className="mt-6 space-y-4">
                <PressQuote quote="I have chaired four of these and I have never seen a bid publish a survey that went against it. That is the reason the committee is taking this one seriously."
                  source="Ayesha Kalim, Sedgley ward councillor" />
                <PressQuote quote="The tank holds. That is the sentence that decides whether this is a restoration or a demolition, and in May it came back holds."
                  source="Rhona Okafor, chair, Cotton Mill Baths Trust" />
                <PressQuote quote="Cotton Mill is the last surviving Edwardian baths in the borough with its original tank intact."
                  source="Victorian Society, North West" />
                <PressQuote quote="My mum learned to swim there and so did I, and so did about four thousand other people who are still in this postcode."
                  source="Danny Whelan, volunteer, 41 shifts" />
              </div>
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="Documents" title="The ones behind the numbers" />
            <div className="mt-6 space-y-3">
              <DownloadCard name="Structural survey, May 2026" description="Wallace & Kerr. The £180,000 figure and the tank test." size={4_180_000} href="#" />
              <DownloadCard name="Structural survey, Oct 2023" description="The earlier £240,000 one. Superseded, published anyway." size={3_640_000} href="#" />
              <DownloadCard name="Trust constitution" description="CIO. Includes the clause returning donations if the bid fails." size={286_000} href="#" />
              <DownloadCard name="Business plan, v4" description="Five-year operating model, including the years it does not break even." size={1_120_000} href="#" />
              <DownloadCard name="Council committee report" description="The asset transfer criteria, including where 400 comes from." size={890_000} href="#" />
            </div>

            <div className="mt-10">
              <SectionHeader eyebrow="Photographs" title="Ours, free to use, credit us" />
              <Gallery className="mt-6" columns={2} items={[
                { alt: "The Bury New Road frontage and the 1904 tilework", caption: "Frontage" },
                { alt: "The empty tank from the balcony", caption: "The tank, May 2026" },
                { alt: "The barrel roof from inside the void", caption: "The roof void" },
                { alt: "Volunteers clearing the boiler room", caption: "Boiler room clearance" },
                { alt: "The original mosaic floor in the entrance", caption: "Entrance mosaic" },
                { alt: "The market stall on a Saturday morning", caption: "The stall" },
              ]} />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                High resolution on request and usually within the hour. Credit "Cotton Mill Baths
                Trust" — there is no photographer to name because two volunteers took all of them.
              </p>
            </div>

            <div className="mt-10">
              <SectionHeader eyebrow="Who to ring" title="A person, not an inbox" />
              <div className="mt-6">
                <ContactCard phone="0161 273 4408" email="press@cottonmillbaths.org"
                  address="Cotton Mill Baths Trust, 14 Sedgley Park Road, Manchester M25 9WD" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Rhona Okafor, chair. She answers her own phone including evenings and weekends,
                because a deadline does not care that we are volunteers.
              </p>
              <div className="mt-6">
                <KeyPoints title="If you have five minutes" points={[
                  "The building is listed, so demolition is not the immediate risk — neglect is.",
                  "£180,000 is the roof. Reopening the pool is £1.1m and is a separate, later question.",
                  "400 volunteers is the council's condition. It is not a fundraising device.",
                  "Money is returned if the bid fails. It is in the constitution, clause 14.",
                  "The decision is 14 October and the meeting is public.",
                ]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}

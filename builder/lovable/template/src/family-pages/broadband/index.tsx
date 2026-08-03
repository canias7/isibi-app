// broadband — CAN-I-GET-IT-FIRST: the address checker is the hero and nothing
// on the page means anything until it is answered. Every ISP site in the
// country leads with a 900 Mb price that most of the addresses reading it
// cannot have, which makes the headline a lie for the majority of visitors.
//
// So the checker sits above the packages, the results NAME THE ADDRESS they
// are for, and the service this street cannot get stays on the page saying
// why — because "why can my neighbour have it" is the question that generates
// the phone call, and answering it costs nothing.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { PostcodeInput } from "@/components/ui/postcode-input";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceAvailability } from "@/components/ui/service-availability";
import { BundleRow } from "@/components/ui/bundle-row";

export const Route = createFileRoute("/")({ component: P });

const AT_S36 = [
  {
    name: "Full fibre to the property", headline: "900 Mb down · 900 Mb up",
    status: "available" as const,
    note: "The cabinet on Manchester Road was done in March. Installation is a two-hour appointment and needs somebody in.",
  },
  {
    name: "Full fibre 500", headline: "500 Mb down · 500 Mb up",
    status: "available" as const,
    note: "Same install, same engineer visit. Most households on this street are on this one.",
  },
  {
    name: "Copper broadband", headline: "up to 67 Mb",
    status: "available" as const,
    note: "Still here and still works. Worth taking only if you want to keep the same phone line arrangement.",
  },
  {
    name: "Business leased line", headline: "1 Gb symmetric, 6-hour fix",
    status: "planned" as const,
    note: "Quoted per address — the duct from Deepcar is in but not lit. Ask and we will price it properly rather than guess.",
  },
  {
    name: "Mobile broadband", headline: "4G fallback",
    status: "unavailable" as const,
    note: "There is no usable signal in this valley from any of the four networks. We would rather say so than sell you a router that does not work.",
  },
];

function P() {
  const [postcode, setPostcode] = React.useState("S36 4GJ");
  return (
    <SiteChrome
      name="Ewden Fibre"
      tagline="Full fibre built in the Don and Ewden valleys. Owned by the people who live here."
      links={[
        { label: "Packages", href: "#/packages" },
        { label: "Switching", href: "#/switching" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Check my address", href: "#check" }}
    >
      <section className="border-b border-border" id="check">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Stocksbridge · Deepcar · Bolsterstone · Wharncliffe Side
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Start with the address, not the price
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Every figure on this site depends on which side of the valley you are on. Rather
                than put 900&nbsp;Mb at the top and disappoint two thirds of you, here is the
                checker — and then only the things your address can actually have.
              </p>

              <div className="mt-8 max-w-xs">
                <PostcodeInput value={postcode} onChange={setPostcode} id="pc" />
                <p className="mt-2 text-sm text-muted-foreground">
                  We check the duct records, not a rough coverage map. It takes a second.
                </p>
              </div>

              <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted-foreground">
                No answer for your postcode means we have not built to it yet — say so on the
                switching page and it goes on the map that decides what gets dug next. There are
                four streets on this network because somebody did exactly that.
              </p>
            </div>

            {/* THE RESULT PANEL NAMES THE ADDRESS. Somebody checking their old
                house and ordering off the answer is the failure this prevents,
                and it is silent — the numbers all look right. */}
            <ServiceAvailability address={`${postcode} — Ewden Beck Road, Stocksbridge`} items={AT_S36} />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="At this address"
            title="What each one costs"
            description="The price after the offer ends is beside the offer price, not below the fold. It is the number you will pay for most of the contract."
          />
          <ul className="mt-8 grid gap-4">
            <BundleRow
              name="Full fibre 900"
              parts={[
                { id: "line", what: "900 Mb down and up, no traffic management" },
                { id: "router", what: "Router included, yours to keep" },
                { id: "ip", what: "Static IP", optional: true },
              ]}
              monthlyPrice={44}
              offerMonths={6}
              priceAfterOffer={54}
              contractMonths={18}
              upfrontCost={0}
            />
            <BundleRow
              name="Full fibre 500"
              parts={[
                { id: "line", what: "500 Mb down and up" },
                { id: "router", what: "Router included, yours to keep" },
              ]}
              monthlyPrice={32}
              offerMonths={6}
              priceAfterOffer={38}
              contractMonths={18}
              upfrontCost={0}
            />
            <BundleRow
              name="Copper 67"
              parts={[{ id: "line", what: "Up to 67 Mb down, 18 Mb up" }, { id: "phone", what: "Keeps the existing line" }]}
              monthlyPrice={26}
              contractMonths={12}
              upfrontCost={0}
            />
          </ul>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            There is no line rental on top and no activation fee. The engineer visit is free
            whether or not you go ahead afterwards — if the survey says the run is not possible we
            tell you and that is the end of it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/packages">
              All packages in full
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/switching">
              I am switching or moving
            </a>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader title="The things people ring about" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is the upload really the same as the download?",
                  answer:
                    "On the fibre packages, yes — 900 up and 900 down. It is the single biggest difference from a cable connection and it is why anybody working from here notices within a day.",
                },
                {
                  question: "What happens at the end of the offer period?",
                  answer:
                    "The price goes to the after-offer figure shown on each package, and we write to you a month before it does. It does not creep up annually and there is no inflation clause.",
                },
                {
                  question: "Can I keep my phone number?",
                  answer:
                    "Yes on copper. On full fibre the number moves to a digital line, which works the same for you but needs power — worth knowing if you rely on it in an outage.",
                },
                {
                  question: "Who actually owns this?",
                  answer:
                    "A community benefit society with 340 members, most of whom are customers. There are no shareholders to pay and the accounts are published each March.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}

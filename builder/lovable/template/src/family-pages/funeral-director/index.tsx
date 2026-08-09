// funeral-director — TWO-PATHS: somebody whose father died an hour ago and
// somebody thinking about their own funeral are different readers with nothing
// in common, and a page that averages them serves neither. So: the number, then
// the split, then what happens next in plain sentences.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArrangementSteps } from "@/components/ui/arrangement-steps";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Hartley & Vane" tagline="An independent funeral director in Walkley, Sheffield, since 1954."
      links={[{ label: "What it costs", href: "/costs" }, { label: "Planning ahead", href: "/plan" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Call 0114 234 1954", href: "tel:01142341954" }}>

      {/* The number is the first thing and it is a real link. Somebody reading
          this at three in the morning should not have to copy digits out. */}
      <section className="border-b-2 border-foreground bg-muted/60">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest">Any hour, any day</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <a href="tel:01142341954" className="underline underline-offset-4">0114 234 1954</a>
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A person answers, not a service. There is nothing you need to have ready and there is no
            wrong time to ring — that is what the number is for.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Hartley &amp; Vane · South Road, Walkley · family-owned since 1954</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Two very different reasons to be reading this
          </h1>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-7">
              <h2 className="text-2xl font-semibold tracking-tight">Somebody has died</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Ring us whenever you are ready — tonight, or in the morning, or in three days. Nothing
                is time-critical in the way people fear. Bringing someone into our care is the only
                thing that needs doing soon, and we do that.
              </p>
              <a className="mt-5 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#what-happens">
                What happens next
              </a>
            </div>
            <div className="rounded-xl border border-border bg-background p-7">
              <h2 className="text-2xl font-semibold tracking-tight">You are planning ahead</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Either for yourself or with somebody who is ill. Writing it down fixes the price and,
                more usefully, removes every decision your family would otherwise be making in the
                worst week of their lives.
              </p>
              <a className="mt-5 inline-block rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/plan">
                How planning ahead works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="what-happens" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="After you ring" title="What happens, in order"
          description="No euphemisms and no jargon. Most of these ask nothing of you at all, and where that is true it says so rather than leaving a blank." />
        <ArrangementSteps className="mt-10" steps={[
          {
            title: "You ring, and we come",
            when: "Within about an hour, at any time",
            what: "Two of us come to wherever they are — a house, a hospital, a home — and bring them into our care. It is unhurried and you can be present or not.",
            youDo: null,
          },
          {
            title: "A doctor or the coroner issues the paperwork",
            when: "Usually two to four days",
            what: "The medical examiner reviews the cause of death and the certificate is sent electronically to the register office. If the coroner is involved it takes longer and we will tell you why.",
            youDo: null,
          },
          {
            title: "You register the death",
            when: "Within five days of the certificate",
            what: "At Sheffield Register Office, by appointment. They give you the green form, which is what lets a funeral happen, and as many death certificates as you ask for.",
            youDo: "Book the appointment and go. Take their NHS number and date of birth if you have them — and buy more certificates than you think, because banks keep them.",
          },
          {
            title: "We sit down together",
            when: "Whenever suits you",
            what: "An hour or two, here or at your house. We go through what they would have wanted, what you can afford, and what is possible. Nothing is decided that day unless you want it to be.",
            youDo: "Bring anybody who should be part of it. Bring clothes for them if you would like them dressed in their own things.",
          },
          {
            title: "We book everything",
            when: "Two to three weeks out, usually",
            what: "The crematorium or the church, the celebrant or the minister, the cars, the flowers, the notice in the Star, the order of service. You approve it; we do it.",
            youDo: "Tell us who is speaking and what music. Both can change right up to the week before.",
          },
          {
            title: "The day itself",
            what: "We are there from the morning until everybody has gone. You will not have to organise anything on the day, and nobody will hand you a bill at the end of it.",
            youDo: null,
          },
          {
            title: "Afterwards",
            when: "Whenever you are ready",
            what: "The account comes about a fortnight later. Ashes are ready in three or four days and there is no hurry to collect them — some families take a year, and that is entirely normal.",
            youDo: "Nothing on a deadline. Ring if you want to talk about anything, including things that are not our business.",
          },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Money" title="Every price is published"
                description="Asking what a funeral costs is the thing people cannot bring themselves to do, so we have put the whole list on the site instead. There is no package you have to buy your way out of." />
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  Our simplest funeral is £1,395 including our fee, care, a coffin and a hearse. The
                  crematorium and the doctors charge their own fees on top, which we pay for you and
                  pass on at cost with the receipts.
                </p>
                <p>
                  If money is the problem, say so at the start rather than at the end. There is a
                  government payment some families qualify for and we will help with the form.
                </p>
              </div>
              <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/costs">Every price, itemised →</a>
            </div>
            <div className="space-y-4 self-start">
              <Testimonial item={{ quote: "They told us on the phone, before we had met them, that we did not have to have cars and that most families here do not. Nobody else did that.", name: "Ruth", role: "Walkley" }} />
              <Testimonial item={{ quote: "Three months on, John rang to see how my mum was doing. He had no reason to and nothing to sell us.", name: "Danny", role: "Hillsborough" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Asked often" title="Questions people apologise for asking" />
            <Faq className="mt-6" items={[
              { question: "Do I have to use a funeral director at all?", answer: "No. It is entirely legal to arrange a funeral yourself and the register office will tell you the same. Some families do part of it themselves and ask us for the rest — that is fine and we will quote for it." },
              { question: "Can I see them?", answer: "Yes, whenever you want, in a room on your own for as long as you want. Equally you do not have to, and plenty of people choose not to. Neither is the right answer." },
              { question: "Is a coffin legally required?", answer: "No. A shroud is permitted at every crematorium in Sheffield and at both natural burial grounds. It is also the cheapest option by a long way and nobody will think anything of it." },
              { question: "What if they died abroad?", answer: "Ring us. It is more paperwork and it takes longer, but it is a thing we do several times a year and none of it needs to be your problem." },
              { question: "Can we have it somewhere other than a church or a crematorium?", answer: "Almost anywhere — a pub, a field, the back garden, a cricket club. Burial has more rules than cremation and we will tell you which ones actually apply." },
            ]} />
          </div>
          <div className="space-y-4">
            <SafeImage src={null} alt="The front on South Road" ratio="4/3" />
            <SafeImage src={null} alt="The family room" ratio="4/3" />
          </div>
        </div>
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="Find us" title="South Road" />
              {/* A plain `&` — an entity in a JSX STRING ATTRIBUTE is not
                  decoded and renders as the five literal characters. It only
                  decodes in text children. */}
              <LocationCard className="mt-6" name="Hartley & Vane"
                address="88 South Road, Walkley, Sheffield, S6 3TE"
                note="Step-free at the front. Come in without ringing first — somebody is here nine till five, and out of hours the phone reaches a person at home." />
            </div>
            <SafeImage src={null} alt="South Road, looking down the hill" ratio="16/9" />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}

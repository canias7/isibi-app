// podcast/single-column-capture — A NEWSLETTER. The base family is a feed:
// newest thing on top, subscribe capture riding mid-feed where it will not
// interrupt somebody reading.
//
// A newsletter inverts that, and the reason is that its content is not ON the
// page. A blog reader is here to read; a newsletter reader is here to decide
// whether to let something into their inbox every Thursday for the next two
// years. That is a bigger ask than a click, so the form is the hero — and the
// archive below it is not a feed, it is the EVIDENCE for the decision the form
// is asking for. Same components, opposite jobs.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArticleCard } from "@/components/ui/article-card";
import { EmailCapture } from "@/components/ui/email-capture";
import { Faq } from "@/components/ui/faq";
import { PostMeta } from "@/components/ui/post-meta";
import { PullQuote } from "@/components/ui/pull-quote";
import { ReadingTime } from "@/components/ui/reading-time";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/single-column-capture")({ component: P });
export type Issue = {
  no: number; date: string; title: string; excerpt: string; words: number; topic: string;
};
export const ISSUES: Issue[] = [
  { no: 148, date: "2026-07-30", title: "The bus lane that paid for itself in eleven weeks", topic: "Transport", words: 1420, excerpt: "Leicester's A47 scheme cost £2.1m and recovered it in fines, which is either a triumph or an indictment depending on whether you think a fine is a punishment or a price. The council's own report says both, on consecutive pages." },
  { no: 147, date: "2026-07-23", title: "Nobody knows who owns the high street", topic: "Property", words: 1680, excerpt: "I tried to find the owner of eleven empty shops on one street in Wigan. Four were traceable in under an hour. Three took a week. Two are held by a company dissolved in 2019 and two I never found at all." },
  { no: 146, date: "2026-07-16", title: "What a 20mph limit actually did in Wales", topic: "Transport", words: 1310, excerpt: "Two years of data rather than two months of headlines. Casualties down 26%, journey times up by an average of 47 seconds, and a petition with 469,571 signatures that turned out to be mostly about something else." },
  { no: 145, date: "2026-07-09", title: "The planning objection that works", topic: "Planning", words: 1550, excerpt: "Almost every objection letter is legally irrelevant and gets read as such. Six material considerations are not, and the difference between the two is about forty minutes of reading that nobody tells residents about." },
  { no: 144, date: "2026-07-02", title: "Why your bin collection changed", topic: "Waste", words: 980, excerpt: "The Simpler Recycling rules land in 2027 and about a third of English councils have quietly moved first. The ones that did have better rates and much angrier residents, and both of those are the same fact." },
  { no: 143, date: "2026-06-25", title: "Section 106 money nobody spent", topic: "Planning", words: 1740, excerpt: "Developers paid £8.4bn in contributions over five years. I asked forty councils how much of theirs remains unspent past its deadline. Twenty-nine answered. The answer is a lot, and in four cases it has been returned." },
];
function P() {
  const [done, setDone] = useState(false);
  return (
    <SiteChrome name="Kerbside" tagline="A weekly letter about how British towns actually work."
      links={[{ label: "One issue", href: "#/episode" }, { label: "All 148", href: "#/archive" }, { label: "Who writes it", href: "#/about" }]}
      action={{ label: "Subscribe", href: "#subscribe" }}>

      {/* THE FORM IS THE HERO. Not a bar, not a modal, not a thing that rides
          mid-feed — the top of the page, because the decision being asked for
          is not "read this" but "let this into your inbox every Thursday". */}
      <section id="subscribe" className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Every Thursday · 1,400 words · since 2023
          </p>
          <h1 className="mt-4 text-center text-5xl font-semibold leading-[1.05] tracking-tight text-balance">
            How British towns actually work
          </h1>
          <p className="mt-5 text-center text-lg leading-relaxed text-muted-foreground">
            One thing a week — a bus lane, a planning rule, a bin round — taken apart properly,
            with the documents linked. Written by somebody who reads council papers so that you do
            not have to, and who will tell you when the answer is boring.
          </p>

          <div className="mt-9">
            <EmailCapture
              title="Thursday mornings, about seven"
              blurb="Free, one email a week, and nothing else ever. 11,400 people get it."
              cta="Subscribe"
              done={done}
              doneMessage="Check your inbox — there is a confirmation link and it is the only one you will ever get."
              onSubmit={() => setDone(true)}
              note="No welcome sequence, no upsell, no second list you did not ask for. Unsubscribe is one click in every email and it works immediately."
            />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["11,400", "subscribers"],
              ["62%", "open it, which is very high and I do not entirely trust it"],
              ["0.3%", "unsubscribe a month"],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-semibold tabular-nums">{v}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 py-14">
        {/* THE ARCHIVE IS THE EVIDENCE, not the feed. Its job is to answer
            "is this any good" for somebody who has read the form and not yet
            filled it in — so it leads with a full excerpt rather than a list. */}
        <SectionHeader eyebrow="The proof" title="The last six, in full enough to judge"
          description="No paywall on any of them and there never will be. If six issues do not convince you, a seventh will not either — and the archive of all 148 is a click away." />

        <div className="mt-8 space-y-8">
          {ISSUES.map((i, n) => (
            <article key={i.no} className={n === 0 ? "" : "border-t border-border pt-8"}>
              <PostMeta date={i.date} category={i.topic} readingTime={<ReadingTime words={i.words} />} />
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
                <a className="hover:underline" href="#/episode">
                  <span className="text-muted-foreground tabular-nums">№{i.no}</span> {i.title}
                </a>
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{i.excerpt}</p>
              <a className="mt-3 inline-block text-sm font-medium underline underline-offset-4" href="#/episode">Read the whole thing</a>
            </article>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-10">
          <a className="text-base font-medium underline underline-offset-4" href="#/archive">All 148 issues, in one list →</a>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <PullQuote>
            I have read every council meeting agenda in nine local authorities for three years.
            Roughly one in twenty contains something that would change how you feel about where you
            live. This is that one.
          </PullQuote>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Said by readers" title="Two, and neither of them is my mum" />
          <div className="mt-6 space-y-6">
            <Testimonial item={{
              quote: "I am a planning officer and I send Kerbside to residents who write to us. It explains in fourteen hundred words what I cannot explain in a meeting, and it is right, which is the part that surprised me.",
              name: "Ilse Bergmann", role: "Planning officer, a district council she asked me not to name",
            }} />
            <Testimonial item={{
              quote: "The Section 106 issue made our council answer an FOI they had been sitting on for five months. That is the only newsletter I have ever read that has done something.",
              name: "Tomás Ferreira", role: "Reader since issue 40",
            }} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          {/* columns={2}: this page is max-w-2xl, so four across is 155px a
              stat and every label wraps to six lines. Measured, not guessed. */}
          <StatsBand columns={2} items={[
            { value: "148", label: "Issues, none missed" },
            { value: "Thursday", label: "Every one of them, about seven" },
            { value: "1,400", label: "Words, give or take three hundred" },
            { value: "£0", label: "It is free and there is no paid tier" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Asked often" title="Mostly about the inbox rather than the writing" />
          <Faq className="mt-6" items={[
            { question: "How often is it, really?", answer: "Once a week, Thursday, about seven in the morning. 148 issues and 148 Thursdays — I have not missed one and if I ever do it will be because something has happened to me rather than because I was busy." },
            { question: "Will you sell my address?", answer: "No, and there is nobody to sell it to — there is no advertiser, no sponsor and no second list. The full list of who can see it is: me, and the mail provider, who is named on the about page." },
            { question: "Is there a paid version?", answer: "No, and not because I am saving it for later. Charging would mean writing for the people who pay, and the whole point is that it goes to a planning officer and to somebody objecting to their scheme in the same week." },
            { question: "How do I unsubscribe?", answer: "One click at the bottom of any issue, no confirmation page, no 'are you sure', and it takes effect immediately. About 0.3% do it every month and that is a perfectly healthy number." },
            { question: "Can I read it without subscribing?", answer: "Yes, all 148, free, no account. The archive is genuinely the whole thing rather than the first two paragraphs — that link is at the top of this page and nothing is held back behind it." },
            { question: "Do you take sponsors?", answer: "No. I have turned down four, one of which was a very large amount for something I write about, and the about page names the industry rather than the company." },
          ]} />
        </section>

        {/* THE SECOND ASK, at the bottom, after the evidence has been read.
            Not a repeat of the hero — this one has something the first did
            not: everything above it. */}
        <section className="mt-14 border-t border-border pt-10">
          <div className="rounded-lg border border-foreground p-6">
            <p className="text-lg font-semibold">Now that you have read six of them</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              That is the whole pitch and it was above the fold as well. If it is a yes, this is
              the same form.
            </p>
            <div className="mt-5">
              <EmailCapture id="subscribe-foot" cta="Subscribe" done={done}
                doneMessage="Already done — check your inbox for the confirmation."
                onSubmit={() => setDone(true)}
                note="Thursday mornings. One click to leave, any time, no questions." />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}

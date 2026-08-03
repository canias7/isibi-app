// translation /quote — sending a document, and the two questions that decide
// everything.
//
// "WHO IS GOING TO RECEIVE IT" IS THE QUESTION NOBODY IS ASKED. It decides
// whether you need certification, notarisation or neither, and getting it wrong
// means the document is rejected and paid for twice. It is the first field
// here, before the file.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { WordCount } from "@/components/ui/word-count";
import { TurnaroundNote } from "@/components/ui/turnaround-note";
import { CertificationRow } from "@/components/ui/certification-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/quote")({ component: P });

const SAMPLE = `Zaświadczenie o niekaralności wydane na wniosek osoby zainteresowanej w celu przedłożenia w postępowaniu wizowym. Krajowy Rejestr Karny nie zawiera danych o osobie wskazanej we wniosku. Dokument sporządzono na podstawie art. 19 ustawy o Krajowym Rejestrze Karnym.`;

const NEED = [
  { q: "Who is going to receive it?", why: "This decides certification, notarisation or neither, and it is the answer that costs people money. UKVI and a university want a certified translation; a foreign consulate usually wants notarisation on top." },
  { q: "What is the deadline, and is it real?", why: "A genuine Friday deadline gets a Friday delivery. A padded one costs you a same-day surcharge you did not need — tell us the true date and we will work back from it." },
  { q: "Is the source legible?", why: "A photograph of a photocopy of a fax is often unreadable and we will say so rather than guess. Handwriting adds £0.04 a word because it has to be transcribed first." },
  { q: "Which variety of the language?", why: "Simplified or Traditional Chinese, MSA or Levantine Arabic, Brazilian or European Portuguese. The wrong one is not a small error and the recipient will notice." },
  { q: "Is there terminology we must match?", why: "A previous translation, a company glossary, an agreed job title. Send it — consistency with what a reader has seen before is worth more than any individual word choice." },
];

function P() {
  const [text, setText] = React.useState(SAMPLE);
  return (
    <SiteChrome
      name="Attercliffe Language Services"
      tagline="Send a document. Five questions, and the first one is the important one."
      links={[
        { label: "Pairs", href: "#/" },
        { label: "Rates", href: "#/rates" },
      ]}
      action={{ label: "Ring 0114 244 8810", href: "tel:01142448810" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight">Send a document</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Email it to quotes@attercliffelanguage.co.uk, or paste the text below for an instant word
          count. A quote comes back within two working hours and it is a fixed figure, not a range.
        </p>

        <section className="mt-10">
          <SectionHeader
            eyebrow="Count it yourself"
            title="Paste the source text"
            description="Source words, which is what we charge on. Multiply by the pair's rate — £0.11 for Polish — or the £45 minimum, whichever is more."
          />
          <div className="mt-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              aria-label="Source text to count"
              className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
            />
            <div className="mt-3">
              <WordCount text={text} min={400} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Under 400 words the £45 minimum applies rather than the per-word rate. It covers
              reading the file, translating it, a second pair of eyes, certification and the post.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Five questions"
            title="And the first is the one that costs people money"
            description="Answer these in the email and the quote comes back right first time rather than after three exchanges."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {NEED.map((n) => (
              <li key={n.q} className="py-5">
                <p className="font-medium">{n.q}</p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{n.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader eyebrow="When" title="The queue today" />
              <div className="mt-6">
                <TurnaroundNote
                  from={3}
                  to={5}
                  unit="working days"
                  busyNote="Polish and Romanian are running long this fortnight. Under 500 words is next working day in every pair, and same-day is available at £0.06 a word on top."
                />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Notarisation adds three working days and an apostille about ten. Neither is under our
                control and neither can be hurried by paying more.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="What you get back" title="A named translator and a signed statement" />
              <ul className="mt-6 space-y-3">
                <CertificationRow
                  standard="Certificate of accuracy"
                  scope="Signed, dated, on letterhead, with the translator named"
                  body="Attercliffe Language Services"
                  state="valid"
                />
                <CertificationRow
                  standard="ISO 17100:2015 process"
                  scope="Translation, revision by a second linguist, final check"
                  body="BSI"
                  reference="TS-88214"
                  state="valid"
                  validUntil="2028-01-14"
                />
              </ul>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A PDF the same day it is finished and a signed hard copy in the post at no extra
                charge. Extra copies are £12 each and worth ordering up front — reprinting later
                means a fresh signature and another envelope.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader title="Sending questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is my document confidential?",
                  answer:
                    "Yes. Every translator has signed an NDA, files are deleted after twelve months unless you ask otherwise, and nothing is put through a public machine-translation service. Asylum and medical work is handled by two named people only.",
                },
                {
                  question: "Can you work from a photograph?",
                  answer:
                    "Usually. Flat, in focus, all four corners visible, one page per image. A photograph of a screen showing a scan is where it stops being possible and we will tell you rather than guessing at a date.",
                },
                {
                  question: "What if I need it certified but the original is a copy?",
                  answer:
                    "We certify the translation of what we were given and the statement says explicitly that the source was a copy. That is honest and most authorities accept it — the ones that do not will have said so.",
                },
                {
                  question: "Do you do a free sample?",
                  answer:
                    "For jobs over 10,000 words, 300 words free, so you can judge register and terminology before committing. Below that it is not worth anybody's time and we would rather just do it properly.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The pairs</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/rates">Every rate</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}

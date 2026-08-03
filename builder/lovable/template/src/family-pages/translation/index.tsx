// translation — LANGUAGE-PAIR-FIRST, in the terminal register.
//
// TERMINAL IS THE RIGHT SKELETON HERE and not an aesthetic choice: the product
// is words, a rate and a deadline. A stock photograph of a globe or of people
// shaking hands adds nothing and this trade is full of both.
//
// CERTIFIED, SWORN AND NOTARISED ARE THREE DIFFERENT THINGS and the customer
// almost never knows which they need. Getting it wrong means the Home Office or
// a court rejects the document and the whole thing is paid for twice. Saying
// which is which is the most valuable paragraph on any translation website.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RateCard } from "@/components/ui/rate-card";
import { TurnaroundNote } from "@/components/ui/turnaround-note";
import { CertificationRow } from "@/components/ui/certification-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const PAIRS = [
  { pair: "Polish ⇄ English", rate: "£0.11 a word", note: "Two translators, both native. Our largest pair by some distance." },
  { pair: "Romanian ⇄ English", rate: "£0.11 a word", note: "One translator, native Romanian, ITI qualified." },
  { pair: "Urdu ⇄ English", rate: "£0.13 a word", note: "Including Home Office document work." },
  { pair: "Arabic ⇄ English", rate: "£0.13 a word", note: "MSA and Levantine. Not Maghrebi — we refer that on." },
  { pair: "Slovak ⇄ English", rate: "£0.12 a word" },
  { pair: "Czech ⇄ English", rate: "£0.12 a word" },
  { pair: "Farsi ⇄ English", rate: "£0.14 a word", note: "One translator. Capacity is genuinely limited — ask early." },
  { pair: "Tigrinya ⇄ English", rate: "£0.16 a word", note: "Rare and in demand. Mostly asylum casework." },
  { pair: "BSL interpreting", rate: "£65 an hour", note: "Two-hour minimum. RBSLI registered." },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Language Services"
      tagline="Nine pairs. Sheffield. Certified for the Home Office, courts and the NHS."
      links={[
        { label: "Rates", href: "#/rates" },
        { label: "Send a document", href: "#/quote" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Get a quote", href: "#/quote" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            ITI corporate member · Nine pairs · Est. 2009
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Rate, pair, deadline
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            That is the whole product. No stock photograph of a globe, no page about our passion for
            cultural bridges — a per-word figure, the pairs we can genuinely do, and how long the
            queue is today.
          </p>

          <div className="mt-10">
            <ul className="divide-y divide-border border-y border-border font-mono text-sm">
              {PAIRS.map((p) => (
                <li key={p.pair} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,8rem)_1fr] sm:gap-4">
                  <span>{p.pair}</span>
                  <span className="tabular-nums">{p.rate}</span>
                  <span className="font-sans text-muted-foreground">{p.note ?? ""}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Nine pairs and no more. A firm advertising two hundred languages has a spreadsheet of
            freelancers and no way of checking any of them — we would rather refer you to somebody
            who actually does Maghrebi Arabic than pretend.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader
                eyebrow="Turnaround"
                title="Today's queue, not a marketing figure"
                description="Updated every morning. A firm quoting '24 hours' for everything is quoting for a 200-word document and hoping you have one."
              />
              <div className="mt-6">
                <TurnaroundNote
                  from={3}
                  to={5}
                  unit="working days"
                  busyNote="Polish and Romanian are running long this fortnight — a university admissions deadline. Urdu, Arabic and Farsi are all at three days."
                />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Under 500 words is usually next working day. Same-day is £0.06 a word on top and it
                is genuinely available rather than a line on a price list — ring rather than emailing
                if it is urgent.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="What we are certified for" title="Four things, with the references" />
              <ul className="mt-6 space-y-3">
                <CertificationRow
                  standard="ITI corporate membership"
                  scope="All nine pairs"
                  body="Institute of Translation and Interpreting"
                  reference="CM-4471"
                  state="valid"
                  validUntil="2027-03-31"
                />
                <CertificationRow
                  standard="Home Office accepted certification"
                  scope="Immigration and nationality documents"
                  body="Self-certified to UKVI requirements"
                  state="self-declared"
                />
                <CertificationRow
                  standard="ISO 17100:2015"
                  scope="Translation services"
                  body="BSI"
                  reference="TS-88214"
                  state="valid"
                  validUntil="2028-01-14"
                />
                <CertificationRow
                  standard="NRPSI registration"
                  scope="Court and police interpreting, Polish only"
                  body="National Register of Public Service Interpreters"
                  reference="14882"
                  state="valid"
                  validUntil="2027-09-30"
                />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* THE THREE WORDS PEOPLE CONFUSE, AND IT COSTS THEM. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <SectionHeader
            eyebrow="Certified, sworn or notarised"
            title="Three different things, and getting it wrong means paying twice"
            description="The Home Office, a court and a foreign consulate all want something different. Almost nobody knows which they need and almost no translation firm explains it."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Certified — £25</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A signed statement from us that it is accurate and complete. What UKVI, the DVLA,
                universities and the NHS want. It is what nine enquiries in ten actually need.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Sworn — not a UK thing</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                There is no sworn translator system in England. If a foreign authority asks for one,
                what they will accept is a certified translation plus notarisation — ask them and
                tell us what they say.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Notarised — £90 on top</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A notary public witnesses our statement. Needed for many overseas uses and almost
                never for anything domestic. An apostille on top is a further £45 and about ten days.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ring and tell us who is going to receive the document. That one question decides which
            of these three you need and it is free to ask.
          </p>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do you use machine translation?",
                  answer:
                    "For a first pass on long technical material, sometimes, and always post-edited by the named translator. Never for certified documents, legal work or anything going to the Home Office. We will tell you which applies to your job.",
                },
                {
                  question: "How is the word count measured?",
                  answer:
                    "Source words, counted before we start, and the figure we quote is the figure you pay. Counting the target lets a translator inflate the bill by writing longer, and some firms do exactly that.",
                },
                {
                  question: "Can you translate a handwritten document?",
                  answer:
                    "Usually, and it is £0.04 a word more because it has to be transcribed first. Send a photograph and we will tell you whether it is legible before quoting.",
                },
                {
                  question: "Who actually does the work?",
                  answer:
                    "A named person, always into their native language, and you can have their name and qualification. Anonymous work is how quality problems become nobody's responsibility.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}

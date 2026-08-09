// podcast /about — who makes it, how it's made, how to pitch or sponsor.
// The page other media, guests and advertisers check before they email; the
// feed never has to explain itself because this page does.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AuthorByline } from "@/components/ui/author-byline";
import { EmailCapture } from "@/components/ui/email-capture";
import { Faq } from "@/components/ui/faq";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/about")({ component: P });
const CHROME = {
  name: "Made in Sheffield", tagline: "A podcast about this city, fortnightly.",
  links: [{ label: "Latest", href: "/" }, { label: "All episodes", href: "/archive" }, { label: "About", href: "/about" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">What this is</h1>
        <div className="prose prose-sm mt-4 max-w-none text-foreground">
          <p>Forty-one episodes about one city: the works, the streets, the music, the football, and the people who were actually there. Fortnightly since 2025, usually 45 minutes, always first-hand — if nobody in the room lived it, we don't make the episode.</p>
          <p>It's recorded in a spare room in Nether Edge on two decent microphones, and edited on the 52 bus more often than we'd like to admit.</p>
        </div>
        <StatsBand className="mt-8" items={[
          { value: "41", label: "Episodes" },
          { value: "18k", label: "Listens a month" },
          { value: "74%", label: "Listening from S postcodes" }]} />
        <section className="mt-10">
          <h2 className="text-lg font-medium">Who makes it</h2>
          <div className="mt-3 grid gap-3">
            <AuthorByline name="Sam Okonkwo" role="Asks the questions, does the edit" />
            <AuthorByline name="Jess Hartle" role="Finds the people, checks the facts" />
          </div>
        </section>
        <section className="mt-10">
          <Faq items={[
            { question: "I have a story — how do I pitch it?", answer: "Email hello@ with two sentences: what happened, and who can tell it first-hand. We read everything; first-hand wins every time." },
            { question: "Do you take sponsors?", answer: "One per episode, read by us, only things we'd actually use. Rates are in the sponsor sheet — ask and it's yours." },
            { question: "Can I use a clip?", answer: "Up to two minutes with credit, yes. Longer, just ask — the answer is usually yes." },
          ]} />
        </section>
        <div className="mt-10">
          <EmailCapture title="One email, every other Tuesday" blurb="The new episode and the one photo that didn't fit." note="No lists sold, leave with one click." onSubmit={() => {}} />
        </div>
      </div>
    </SiteChrome>
  );
}

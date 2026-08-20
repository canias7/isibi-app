// nursery /visit — book a look round, and what to bring when you come. The
// session table appears again here because "which session" is the first thing
// the form needs and sending somebody back to the home page to find it is how
// an enquiry gets abandoned.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SessionTable } from "@/components/ui/session-table";
export const Route = createFileRoute("/visit")({ component: P });
function P() {
  return (
    <SiteChrome name="Bole Hills Nursery" tagline="A 42-place nursery and pre-school in Walkley, Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "A day here", href: "/day" }]}
      action={{ label: "Book a visit", href: "#book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Come and look" title="Half ten on a Tuesday, when it is loud"
          description="We do not do showround slots on a quiet Saturday morning. You learn nothing from an empty room, and you would be choosing on the wrong information." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What happens</h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Forty minutes or so. You see both rooms and the garden while the children are in
                them, and you can stay longer if the person showing you round is not needed.
              </p>
              <p>
                Bring your child. It tells you more than anything we say — where they go, whether
                they look back at you, whether anybody notices them arrive.
              </p>
              <p>
                We will ask which sessions you want and tell you honestly whether they exist. If
                they do not, we will say so on the day rather than putting you on a list.
              </p>
            </div>
            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Worth bringing</h2>
            <ul className="mt-3 space-y-2 text-base">
              <li className="border-b border-border pb-2">Your funding code, if you already have one</li>
              <li className="border-b border-border pb-2">The days and hours you actually need, including the awkward ones</li>
              <li className="border-b border-border pb-2">Anything about allergies, additional needs or a plan already in place</li>
              <li className="border-b border-border pb-2">Questions you feel silly asking. Those are usually the useful ones</li>
            </ul>
          </div>
          <div className="space-y-4">
            <SafeImage src={null} alt="The entrance on Cundy Street" ratio="4/3" />
            <SafeImage src={null} alt="An ordinary Tuesday in the pre-school room" ratio="4/3" />
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Before you ask" title="Where there is room right now"
            description="Same table as the home page, here so you do not have to go back for it. Updated every Monday." />
          <SessionTable className="mt-8" fundedLabel="15 & 30 funded hours cover this" days={[
            {
              day: "Monday",
              sessions: [
                { name: "Morning", from: "08:00", to: "13:00", placesLeft: 2, funded: true },
                { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 6, funded: true },
              ],
            },
            {
              day: "Tuesday",
              sessions: [
                { name: "Morning", from: "08:00", to: "13:00", placesLeft: 0, funded: true },
                { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 4, funded: true },
              ],
            },
            {
              day: "Wednesday",
              sessions: [
                { name: "Morning", from: "08:00", to: "13:00", placesLeft: 1, funded: true },
                { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 5, funded: true },
              ],
            },
          ]} />
        </section>

        <section id="book" className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Book it" title="Tell us roughly when"
                description="Steph reads these herself and answers within a day. Say which sessions you are after and she will tell you straight away whether they are there." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Or just turn up</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Ring the bell between ten and half eleven on a weekday. If somebody can show you
                round they will, and if they cannot we will book you in for later that week.
              </p>
              <LocationCard className="mt-6" name="Bole Hills Nursery"
                address="14 Cundy Street, Walkley, Sheffield, S6 2WX"
                note="Step-free throughout. Two parking bays on site and unrestricted parking on Fir Street. The 95 stops at the top of the road." />
              <Faq className="mt-8" items={[
                { question: "Can I bring a grandparent?", answer: "Bring whoever will be doing the pick-ups. They will have more practical questions than you do." },
                { question: "How soon could we start?", answer: "Two weeks for a settling-in plan, sooner if you need it sooner. Nobody is left to settle on their own on day one." },
                { question: "Do I have to decide on the day?", answer: "No, and we would rather you looked at two or three places. A deposit only comes in when you want to hold a specific session." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}

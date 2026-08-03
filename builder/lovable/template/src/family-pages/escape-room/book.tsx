// escape-room /book — picking a time, and the rules that ACTUALLY matter.
//
// MOST HOUSE RULES ON THESE SITES ARE LEGAL BOILERPLATE NOBODY READS. The three
// that matter to a customer are: you are never locked in, the clue policy is
// unlimited and free, and being late costs your own time rather than the next
// group's. Everything else can be a paragraph.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { TicketTiers } from "@/components/ui/ticket-tiers";
import { HouseRules } from "@/components/ui/house-rules";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/book")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Neepsend Lock-In"
      tagline="Pick a time. A slot is the room for the hour, whoever is in it."
      links={[
        { label: "Tonight", href: "#/" },
        { label: "The rooms", href: "#/rooms" },
      ]}
      action={{ label: "The rooms", href: "#/rooms" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Booking</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A slot is the room for the hour, whatever the group size. Five people cost the same as
          three, which is the opposite of how most venues price it and is why nobody here has ever
          been asked to bring an extra person.
        </p>

        <section className="mt-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Thursday 6 August"
                title="What is free"
                description="Arrive fifteen minutes before. The briefing is eight minutes and the clock starts after it."
              />
              <div className="mt-6">
                <AvailabilityGrid
                  slots={["17:00", "18:15", "19:30", "20:45", "22:00"]}
                  taken={["18:15", "19:30"]}
                  value="20:45"
                />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Weekday afternoons are wide open and are the nicest time to come — quieter, and the
                games master is not running two rooms at once.
              </p>
            </div>
            <TicketTiers
              tiers={[
                { key: "room", label: "The room, any group size", price: 78, note: "Up to six people. Not per person." },
                { key: "off", label: "Weekday before 17:00", price: 58, note: "Same rooms, same hour, quieter." },
                { key: "two", label: "Two rooms in one visit", price: 138, note: "Two hours forty-five with a break. The second is always better.", remaining: 4 },
                { key: "student", label: "Student, weekday", price: 48, note: "Any ID with a photograph and a date. We do not check it hard.", remaining: 6 },
              ]}
              quantities={{ room: 1, off: 0, two: 0, student: 0 }}
              onQuantity={() => {}}
              cta="Hold this slot"
              lowAt={5}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The rules"
            title="Three that matter, and a few that are just sensible"
            description="Most venues publish a page of legal boilerplate. These are the ones that change what your hour is actually like."
          />
          <div className="mt-8 max-w-3xl">
            <HouseRules
              heading="In the room"
              arrive="Fifteen minutes before your slot"
              leave="Straight after, or stay for a drink — there is a bar and nobody is moved on"
              lateNote="Late costs your own time, not the next group's. Turn up twenty minutes late and you have forty minutes. We will not refuse you and we cannot give you the hour back."
              rules={[
                { what: "You are never locked in", detail: "The door opens from the inside at any moment, always. It is a fire regulation and it is also just decent. Leave whenever you want, for any reason." },
                { what: "Clues are unlimited and free", detail: "Ask as often as you like. Nobody is penalised, nothing is deducted, and the games master will nudge before you get properly stuck rather than watching you suffer." },
                { what: "Nothing needs force", detail: "If something will not move, it is not the answer. Everything opens with a key, a code or a hand. Nobody has ever needed to pull hard at anything." },
                { what: "Phones away, or not — your call", detail: "We would rather you did not photograph the puzzles, and we are not going to take your phone off you. Torches are allowed and they spoil the Grinding Hull." },
                { what: "One drink beforehand is fine, four is not", detail: "We will turn away a group that is obviously drunk, refund half, and mean it kindly. It is not a moral position — it is that you will not enjoy it." },
                { what: "Over eight, with an adult in the room", detail: "Under-eights genuinely do not enjoy these and we would rather say so than take the booking." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Changing or cancelling"
            title="48 hours, and the exceptions are real"
            description="Move a booking free up to 48 hours before. Inside that we will still try, because a slot we can refill costs us nothing."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">More than 48 hours</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Move or cancel free, no reason, in one email. Refunded within three days.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Inside 48 hours</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ring us. If we can refill the slot you get it all back, and on a Friday or Saturday
                we usually can. Otherwise it is 50%.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Somebody is ill</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Move it, free, whenever. We will not ask for proof and nobody should be doing this
                with the flu.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Booking questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can we book for eight people?",
                  answer:
                    "Two rooms at the same time rather than eight in one — six is a genuine maximum and five is better. Two groups of four in different rooms is the best evening we sell.",
                },
                {
                  question: "Is there parking?",
                  answer:
                    "Free on Rutland Road after 18:00 and at weekends, and there is a car park behind the Gardeners Rest two minutes away. It is a five-minute walk from Shalesmoor tram stop.",
                },
                {
                  question: "Do we get a photograph?",
                  answer:
                    "If you want one, and only if you want one. It is taken after, never during, and we will not put it on social media without you saying yes on the night.",
                },
                {
                  question: "Can we book the whole venue?",
                  answer:
                    "All four rooms for two and a half hours, £280, up to 24 people rotating. It is what most works dos actually want and it is cheaper than four separate bookings.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Tonight</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/rooms">The four rooms</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}

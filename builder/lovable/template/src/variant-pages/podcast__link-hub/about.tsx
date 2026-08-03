// podcast/link-hub /about — "who makes it, how it's made, how to pitch or
// sponsor". For a one-person food business the sponsor question does not exist
// and the pitch question is wholesale, so this page answers the two things
// people actually message about: can you make more, and can you deliver to me.
//
// Both answers are no, and the page is mostly the explanation. A link hub whose
// About page says "get in touch!" wastes the one place the owner can head off
// the four messages a day they cannot say yes to.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactCard } from "@/components/ui/contact-card";
import { Faq } from "@/components/ui/faq";
import { KeyPoints } from "@/components/ui/key-points";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/about")({ component: P });
function P() {
  return (
    <SiteChrome name="Bread by Bike" tagline="Sourdough out of a back kitchen in Splott. Delivered on two wheels."
      links={[{ label: "All the links", href: "#/" }, { label: "Order", href: "#/episode" }, { label: "Everything", href: "#/archive" }]}
      action={{ label: "Order", href: "#/episode" }}>

      <div className="mx-auto max-w-md px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← Everything else</a>

        <div className="mt-6 text-center">
          <div className="mx-auto w-32">
            <SafeImage src={null} alt="Nerys and the bike outside the Clifton" ratio="1/1" className="rounded-full" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Nerys Vaughan</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            One oven, one person, a bike with a box on the front, and sixty loaves a week.
          </p>
        </div>

        <p className="mt-8 text-base leading-relaxed text-muted-foreground">
          I was a chef for eleven years and then I was not, for reasons that had a lot to do with
          fifteen-hour days. This started in 2020 as four loaves a week for neighbours and it has
          grown into sixty loaves a week for about ninety households, which is as big as it is
          going to get.
        </p>

        {/* THE TWO ANSWERS, BOTH NO, both stated properly. This is the page's
            real job: four messages a day ask one of these and a cheerful "get
            in touch" turns every one of them into a disappointment later. */}
        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="The two things people ask" title="And the answer to both is no" />
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border border-border p-5">
              <p className="text-base font-medium">"Can you make more?"</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                No. One domestic oven takes four loaves and a bake is four hours, so sixty is
                fifteen bakes across Thursday and Friday and there is no sixty-first. A bigger oven
                means a commercial unit, a unit means rent, rent means volume, and volume is the
                thing that made me stop being a chef.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-base font-medium">"Can you deliver to me?"</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Only if you are on the flat. 35kg of bread on a bike front, and Penylan hill is 9% —
                that is not a fitness problem, it is a physics one. Type your postcode and it will
                tell you honestly.
              </p>
              <div className="mt-4">
                <ServiceArea
                  areas={["CF24", "CF23", "CF10", "Splott", "Adamsdown", "Roath", "Tremorfa", "Pengam"]}
                  placeholder="CF24, Splott, Roath…"
                  note="Outside that, collection Thursday at the market or Saturday at the Clifton — both free and both a ten-minute bus." />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="Wholesale" title="Three cafés, and room for one more" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A standing order, same quantity every week, delivered before seven. It is the only part
            of this that scales at all and it is capped at four for the same oven reason.
          </p>
          <div className="mt-5">
            <SpecList>
              <SpecRow label="Minimum" value="8 loaves" note="A week, same day, same number. A varying order does not work on one oven" highlight />
              <SpecRow label="Price" value="£3.20 a loaf" note="Against £4.50 retail. That is the whole discount and it does not move" highlight />
              <SpecRow label="Delivery" value="Before 7am" note="By bike, inside the flat area only, same as everybody" />
              <SpecRow label="Invoicing" value="Monthly" note="30 days. Two of the three pay in a week and I have never chased anyone" />
              <SpecRow label="Notice" value="Two weeks, either way" note="No contract. If it stops working for you it stops working" />
              <SpecRow label="Places" value="1 of 4" note="When it is four it is four, and there is no waiting list because I would never get to it" />
            </SpecList>
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="How it is made" title="Which is most of what the posts are about" />
          <div className="mt-5">
            <KeyPoints title="Five true things" points={[
              "Three ingredients — flour, water, salt — plus a starter that is about forty years old.",
              "Eighteen hours from mix to oven, almost all of it waiting rather than working.",
              "Welsh flour from Felin Ganol in Llanrhystud, milled about ninety miles away.",
              "No commercial yeast, no improver, no dough conditioner, and no sourdough 'flavouring'.",
              "A domestic oven, a baking stone and a roasting tin of water. Nothing here needs a unit.",
            ]} />
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="How it got here" title="Six years, from four loaves" />
          <div className="mt-6">
            <Timeline items={[
              { when: "April 2020", title: "Four loaves for four neighbours", description: "Everybody was baking. Mine were better than they had any right to be and people asked for more." },
              { when: "September 2021", title: "Registered with the council", description: "Rating 5 at the first inspection. The kitchen is inspected as a food business and has been every year since." },
              { when: "March 2022", title: "The bike", description: "Second-hand cargo bike, £900, and it changed the business more than the oven ever did." },
              { when: "November 2023", title: "First wholesale café", description: "Eight loaves a week. Still with them and they still take eight." },
              { when: "June 2024", title: "Turned down a supermarket", description: "Four hundred loaves a week. It was a lot of money and it was also somebody else's business." },
              { when: "Now", title: "Sixty a week, ninety households", description: "Which is exactly as big as one oven and one person goes, and it is enough." },
            ]} />
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="Get in touch" title="Instagram or email, and I read both" />
          <div className="mt-5">
            <ContactCard email="nerys@breadbybike.wales" address="Bread by Bike, Splott, Cardiff CF24" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            No phone number, and that is not standoffishness — I am usually elbow-deep in dough or
            on a bike, and a message I can answer at four o'clock gets a better answer than a call
            I cannot take. Everything gets a reply, usually within a day.
          </p>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="Asked often" title="The rest" />
          <Faq className="mt-6" items={[
            { question: "Is it actually sourdough?", answer: "Yes, in the sense the word is supposed to mean: flour, water, salt and a starter, no commercial yeast and eighteen hours. Most supermarket 'sourdough' contains yeast and that is legal, which is the whole reason people ask." },
            { question: "Is it gluten free?", answer: "No, and it never will be — a gluten-free bake in the same kitchen is not something I can do safely. Everything here contains wheat and is made in a kitchen that also has sesame in it." },
            { question: "Why is it £4.50?", answer: "The maths is in the archive. Flour, power, packaging and the market pitch come to about £1.80 a loaf, and the rest is roughly nine hours a week of my time across the whole bake." },
            { question: "Can I pay in advance for a month?", answer: "You can and about a dozen people do. It helps me and it commits you to bread you might not want, so I only say yes to people who have been ordering for a while." },
            { question: "What if I cannot collect?", answer: "Text me. A loaf held over to Saturday is fine and a loaf nobody collects goes to the pub, which has never once complained." },
            { question: "Do you do celebration cakes?", answer: "No. I am a bread baker and a bad cake decorator, and there are four people within a mile who are the other way round." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}

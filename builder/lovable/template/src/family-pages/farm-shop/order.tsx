// farm-shop /order — the box, the day and the drop point. A box scheme lives or
// dies on the drop point being convenient, so those get names and hours rather
// than a map pin.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { MenuSection } from "@/components/ui/menu-section";
import { ProduceCalendar } from "@/components/ui/produce-calendar";
import { SectionHeader } from "@/components/ui/section-header";
import { GROWN } from "./index";
export const Route = createFileRoute("/order")({ component: P });
const DROPS = [
  { name: "The farm", where: "Hollin Busk Lane, in the shop", when: "Wednesday and Friday, any time we are open", note: "Free. Boxes are on the trestle by the door with your name on." },
  { name: "Stocksbridge Library", where: "Manchester Road", when: "Wednesday, 2pm–6pm", note: "Free. Ask at the desk — they have kept boxes for us since 2017." },
  { name: "The Sportsman, Lodge Moor", where: "Redmires Road", when: "Friday, 4pm–8pm", note: "Free. In the porch, not the bar. Collect the same evening." },
  { name: "Kelham Island, The Grinding Shop", where: "Alma Street", when: "Friday, 10am–5pm", note: "Free. Gallery is closed Monday and Tuesday, which is why it is a Friday drop." },
  { name: "To your door", where: "Within five miles of the farm", when: "Wednesday or Friday, 8am–2pm", note: "£2, free on a large box. We do not give a time slot and we will not pretend to." },
];
function P() {
  return (
    <SiteChrome name="Hollin Busk Farm Shop" tagline="A working farm and shop above Stocksbridge, growing on eleven acres."
      links={[{ label: "Home", href: "#/" }, { label: "The year", href: "#/season" }]}
      action={{ label: "Order a box", href: "#form" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Order" title="Pick a size, a day and where to get it"
          description="No subscription in the app-store sense. It is a standing order you can pause with a text, and there is no contract and no minimum." />

        <section className="mt-12">
          <MenuSection groups={[
            {
              name: "The boxes",
              items: [
                { name: "Small", price: 12, description: "Six or seven things. A week for two who cook most nights." },
                { name: "Medium", price: 18, description: "Nine or ten things. A family of four, cooking from it properly." },
                { name: "Large", price: 26, description: "Everything in the medium and more of it, plus whatever we have too much of." },
                { name: "Fruit only", price: 9, description: "Seasonal, so it is thin in February and enormous in August. Ordered as an add-on by most people." },
              ],
            },
            {
              name: "Add to any box",
              items: [
                { name: "Eggs", price: 3.2, description: "Half a dozen, from the hens up the lane. They stop properly in January and we say so." },
                { name: "Bread", price: 3.5, description: "Seven Hills, baked that morning. Wednesdays and Saturdays only, and it is not ours." },
                { name: "Milk", price: 1.6, description: "Two pints in glass, from Hoyland. £1.30 if you bring the bottle back." },
                { name: "Honey", price: 6.5, description: "From the hives in the orchard. About forty jars a year, so it runs out." },
                { name: "Potatoes, extra sack", price: 8, description: "5kg, from the barn. October to March only, because after that ours are gone." },
              ],
            },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Where to get it" title="Five drop points, four of them free"
            description="Named, with hours, because a box scheme lives or dies on whether the pickup is on your way home." />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {DROPS.map((d) => (
              <li key={d.name} className="grid gap-x-8 gap-y-2 py-5 lg:grid-cols-[1.1fr_1.2fr_1fr_1.3fr]">
                <span className="text-lg font-medium">{d.name}</span>
                <span className="text-sm text-muted-foreground">{d.where}</span>
                <span className="text-sm">{d.when}</span>
                <span className="text-sm text-muted-foreground">{d.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Before you order" title="What will actually be in it"
            description="August looks like this. Order in February and it is leeks, kale and roots for the same money — which is the deal, and it is better than it sounds." />
          <ProduceCalendar className="mt-8" items={GROWN} now={new Date(2026, 7, 2)} />
        </section>

        <section id="form" className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Start" title="Tell us the size, the day and the drop"
                description="Ruth sets these up by hand, usually the same evening. Your first box is normally the following week." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">How it works after that</h2>
              <ol className="mt-4 divide-y divide-border border-y border-border text-base">
                <li className="py-3"><span className="font-medium">Standing order</span> — monthly, on the 1st. Four or five boxes a month depending on the weeks; it averages out over the year.</li>
                <li className="py-3"><span className="font-medium">Pause any time</span> — a text by the Sunday. Holidays, a full fridge, whatever. No charge for the weeks you skip.</li>
                <li className="py-3"><span className="font-medium">Swap the size</span> — up or down, week to week, at the difference in price.</li>
                <li className="py-3"><span className="font-medium">Tell us what you hate</span> — we keep a note. Two things per household; more than that and a box scheme is the wrong thing for you.</li>
                <li className="py-3"><span className="font-medium">Stop whenever</span> — no notice, no fee, no exit survey.</li>
              </ol>
              <Faq className="mt-8" items={[
                { question: "Can I choose what goes in?", answer: "No, and that is the point — a box you choose is a shop with extra steps, and choosing is what makes a farm end up growing only the four easy things. You can tell us two things you will not eat." },
                { question: "What if I miss a collection?", answer: "The drop points keep it until they close and then it comes back to the farm. Ring and we will hold it for you, but after two days it goes to the food bank rather than in the bin." },
                { question: "Is it cheaper than the supermarket?", answer: "About the same for the vegetables and worse for the fruit. It is fresher by three or four days and the money stays within eleven acres of here, which is the actual argument." },
                { question: "Do you deliver further out?", answer: "Five miles, and the drop points are how we reach further without putting a van on the road for one box. If you can get a group of six together anywhere, we will add a drop." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}

// caterer /menus — the menus at each band, and the allergen matrix rather than
// a disclaimer.
//
// The menus are written as food rather than as packages. "Silver / Gold /
// Platinum" tells a customer nothing about what is on the plate and exists to
// make the middle one look reasonable; naming them after what they actually
// are means somebody can choose on the food.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { MenuSection } from "@/components/ui/menu-section";
import { AllergenMatrix } from "@/components/ui/allergen-matrix";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/menus")({ component: P });

const MENUS = [
  {
    name: "Sharing boards — £29 a head",
    note: "Everything on the table at once. The least formal and by some distance the most popular.",
    items: [
      { name: "Slow-roast lamb shoulder, flatbreads, pickles" },
      { name: "Whole side of hot-smoked trout, dill, capers" },
      { name: "Roast squash, whipped feta, honey, dukkah", meta: "V" },
      { name: "Charred hispi cabbage, brown butter, hazelnut", meta: "V" },
      { name: "New potatoes, mustard and chive", meta: "V" },
      { name: "Three salads that change with the season", meta: "Vegan option" },
    ],
  },
  {
    name: "Plated three courses — £34 a head",
    note: "A choice of two per course, taken in advance. Needs a venue with room to plate 120 covers.",
    items: [
      { name: "Chicken liver parfait, sourdough, quince" },
      { name: "Heritage tomato, basil oil, aged sherry vinegar", meta: "Vegan" },
      { name: "Sirloin of Derbyshire beef, dauphinoise, greens" },
      { name: "Hake, brown shrimp butter, samphire" },
      { name: "Wild mushroom and barley risotto", meta: "V" },
      { name: "Set custard, poached rhubarb, shortbread" },
      { name: "Chocolate and olive oil torte", meta: "Vegan" },
    ],
  },
  {
    name: "Hog roast and sides — £24 a head",
    note: "Minimum sixty. The only menu with its own minimum, because a whole pig does not scale.",
    items: [
      { name: "Whole hog, apple sauce, crackling, baps" },
      { name: "Slow-cooked jackfruit for the vegetarians", meta: "Vegan" },
      { name: "Coleslaw, potato salad, dressed leaves", meta: "V" },
      { name: "Loaded new potatoes", meta: "V" },
    ],
  },
  {
    name: "Wakes and funerals — £18 a head",
    note: "Sandwiches, pies, cake and endless tea, set up quietly and cleared without being asked. Forty minimum but we will discuss it.",
    items: [
      { name: "Sandwiches on proper bread, four fillings" },
      { name: "Pork pie, piccalilli" },
      { name: "Cheese scones, butter", meta: "V" },
      { name: "Fruit cake, Wensleydale" },
      { name: "Tea and coffee throughout" },
    ],
  },
];

const ALLERGENS = ["Gluten", "Milk", "Egg", "Fish", "Crustacean", "Nuts", "Peanut", "Soya", "Sesame", "Celery", "Mustard", "Sulphites", "Lupin", "Mollusc"];

const mk = (o: Partial<Record<string, "yes" | "no" | "may" | "unknown">>) =>
  Object.fromEntries(ALLERGENS.map((a) => [a, o[a] ?? "no"])) as Record<string, "yes" | "no" | "may" | "unknown">;

const DISHES = [
  { id: "lamb", name: "Slow-roast lamb shoulder, flatbreads, pickles", contains: mk({ Gluten: "yes", Milk: "yes", Sesame: "yes", Sulphites: "yes", Nuts: "may" }) },
  { id: "trout", name: "Hot-smoked trout, dill, capers", contains: mk({ Fish: "yes", Milk: "yes", Sulphites: "yes", Mollusc: "may" }) },
  { id: "squash", name: "Roast squash, whipped feta, honey, dukkah", contains: mk({ Milk: "yes", Nuts: "yes", Sesame: "yes" }) },
  { id: "parfait", name: "Chicken liver parfait, sourdough, quince", contains: mk({ Gluten: "yes", Milk: "yes", Egg: "yes", Sulphites: "yes" }) },
  { id: "beef", name: "Sirloin of beef, dauphinoise, greens", contains: mk({ Milk: "yes", Celery: "yes", Sulphites: "yes", Mustard: "may" }) },
  { id: "hake", name: "Hake, brown shrimp butter, samphire", contains: mk({ Fish: "yes", Crustacean: "yes", Milk: "yes" }) },
  { id: "torte", name: "Chocolate and olive oil torte", contains: mk({ Soya: "yes", Nuts: "may", Gluten: "may" }) },
  { id: "hog", name: "Whole hog, apple sauce, crackling, baps", contains: mk({ Gluten: "yes", Sulphites: "yes", Milk: "may", Sesame: "may" }) },
];

function P() {
  return (
    <SiteChrome
      name="Whirlow & Vane"
      tagline="Four menus, named after what they are."
      links={[
        { label: "Prices", href: "/" },
        { label: "Get a quote", href: "/quote" },
      ]}
      action={{ label: "Get a quote", href: "/quote" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">The menus</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Four of them, named after what they actually are rather than after precious metals. Any
          of them can be adjusted — this is a kitchen, not a catalogue — and doing so does not
          automatically move the price.
        </p>

        <section className="mt-14">
          <MenuSection groups={MENUS} />
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="All fourteen"
            title="Allergens, per dish"
            description="Contains, may contain, and does not. Three different answers, and the middle one is the honest way to describe a kitchen with shared equipment."
          />
          <div className="mt-8">
            <AllergenMatrix
              allergens={ALLERGENS}
              dishes={DISHES}
              askFor="For a severe allergy, ring 0114 255 8890 and ask for Vicky. She cooks the food and will talk it through properly rather than take a note."
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            We can cook a genuinely separate meal in a clean area with notice — it is the only way
            to be honest about anaphylaxis, and it is free. What we will not do is claim a busy
            event kitchen is allergen-free.
          </p>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="Changing a menu"
            title="It is a kitchen, not a catalogue"
            description="Swapping a course, a family recipe, a dish somebody's grandmother made — all normal requests and none of them a surcharge by default."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Swapping within a menu</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Free, as long as the ingredient cost is similar. Turbot for hake is not; chicken for
                pork is.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Cooking somebody's recipe</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We have done this at maybe thirty weddings and it is usually the thing people
                remember. Send it and we will practise it.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">A tasting</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                £60 for two, refunded against the booking. Weekday evenings at the Abbeydale Road
                kitchen, about six weeks out.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Menu questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do vegetarians pay less?",
                  answer:
                    "No, and the vegetarian dishes are not cheaper to make — good ones rarely are. They are also not an afterthought; there are two on every menu and one of them is usually the best thing on it.",
                },
                {
                  question: "Can we mix two menus?",
                  answer: "Sharing boards to start and plated for the main is the usual combination. Priced at the higher of the two per head.",
                },
                {
                  question: "What about children?",
                  answer: "Half price under twelve, free under three, and it is the same food in a smaller portion rather than nuggets.",
                },
                {
                  question: "How far in advance do you need the final numbers?",
                  answer:
                    "Fourteen days for numbers and dietary requirements. After that we can usually add two or three people and we cannot take any away, because the food is bought.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Prices by headcount</a>
            {" · "}
            <a className="underline underline-offset-4" href="/quote">Send an enquiry</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}

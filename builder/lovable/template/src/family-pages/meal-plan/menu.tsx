// meal-plan /menu — this week and next, and the allergen matrix in full.
//
// FOURTEEN ALLERGENS PER DISH, INCLUDING "MAY CONTAIN". A disclaimer reading
// "prepared in a kitchen that handles nuts" is legally sufficient and
// practically useless: it tells a person with a severe allergy nothing except
// that nobody is going to help them. The matrix distinguishes contains from
// may-contain from does-not, per dish, which is the difference between a menu
// somebody can use and one they have to ring about.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CutoffTime } from "@/components/ui/cutoff-time";
import { MenuSection } from "@/components/ui/menu-section";
import { AllergenMatrix } from "@/components/ui/allergen-matrix";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/menu")({ component: P });

const NEXT_WEEK = [
  {
    name: "Week of 10 August",
    note: "Published on Friday, swappable until the Monday cut-off.",
    items: [
      { name: "Beef shin ragù, pappardelle", description: "3 hours, almost all of it waiting", meta: "Serves 4" },
      { name: "Harissa chicken traybake", description: "45 minutes, one tin", meta: "Serves 2 or 4" },
      { name: "Hake, chorizo, butter beans", description: "25 minutes", meta: "Serves 2" },
      { name: "Mushroom and barley risotto", description: "40 minutes", meta: "V · Serves 2 or 4" },
      { name: "Aubergine parmigiana", description: "70 minutes", meta: "V · Serves 4" },
      { name: "Dal makhani, rice, flatbread", description: "50 minutes · freezes well", meta: "Vegan · Serves 4" },
    ],
  },
];

const ALLERGENS = ["Gluten", "Milk", "Egg", "Fish", "Crustacean", "Nuts", "Peanut", "Soya", "Sesame", "Celery", "Mustard", "Sulphites", "Lupin", "Mollusc"];

const DISHES = [
  {
    id: "kofta", name: "Lamb kofta, flatbreads, pickled onion",
    contains: {
      Gluten: "yes", Milk: "yes", Egg: "no", Fish: "no", Crustacean: "no", Nuts: "may", Peanut: "no",
      Soya: "no", Sesame: "yes", Celery: "no", Mustard: "yes", Sulphites: "no", Lupin: "no", Mollusc: "no",
    } as Record<string, "yes" | "no" | "may" | "unknown">,
  },
  {
    id: "orzo", name: "Chicken thighs with peppers and orzo",
    contains: {
      Gluten: "yes", Milk: "no", Egg: "no", Fish: "no", Crustacean: "no", Nuts: "may", Peanut: "no",
      Soya: "no", Sesame: "no", Celery: "yes", Mustard: "no", Sulphites: "no", Lupin: "no", Mollusc: "no",
    } as Record<string, "yes" | "no" | "may" | "unknown">,
  },
  {
    id: "cod", name: "Cod, brown shrimp butter, greens",
    contains: {
      Gluten: "no", Milk: "yes", Egg: "no", Fish: "yes", Crustacean: "yes", Nuts: "no", Peanut: "no",
      Soya: "no", Sesame: "no", Celery: "no", Mustard: "no", Sulphites: "yes", Lupin: "no", Mollusc: "may",
    } as Record<string, "yes" | "no" | "may" | "unknown">,
  },
  {
    id: "gnocchi", name: "Squash and sage gnocchi",
    contains: {
      Gluten: "yes", Milk: "yes", Egg: "yes", Fish: "no", Crustacean: "no", Nuts: "no", Peanut: "no",
      Soya: "no", Sesame: "no", Celery: "no", Mustard: "no", Sulphites: "no", Lupin: "no", Mollusc: "no",
    } as Record<string, "yes" | "no" | "may" | "unknown">,
  },
  {
    id: "chilli", name: "Black bean chilli, lime crema",
    contains: {
      Gluten: "no", Milk: "yes", Egg: "no", Fish: "no", Crustacean: "no", Nuts: "no", Peanut: "no",
      Soya: "yes", Sesame: "no", Celery: "yes", Mustard: "no", Sulphites: "no", Lupin: "no", Mollusc: "no",
    } as Record<string, "yes" | "no" | "may" | "unknown">,
  },
  {
    id: "saag", name: "Paneer saag with chapatis",
    contains: {
      Gluten: "yes", Milk: "yes", Egg: "no", Fish: "no", Crustacean: "no", Nuts: "yes", Peanut: "no",
      Soya: "no", Sesame: "no", Celery: "no", Mustard: "yes", Sulphites: "no", Lupin: "no", Mollusc: "no",
    } as Record<string, "yes" | "no" | "may" | "unknown">,
  },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Kitchen"
      tagline="Two weeks of menus, and every allergen per dish."
      links={[
        { label: "This week", href: "/" },
        { label: "Plans", href: "/plans" },
      ]}
      action={{ label: "Choose a plan", href: "/plans" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <CutoffTime
            by="Monday 23:59"
            promise="delivery this Thursday or Friday"
            remaining="1 day 6 hours"
            nextPromise="Swaps close at the same moment the orders do."
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">Next week</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Published every Friday, a full week ahead, so anybody planning the shop around it can
            do that. Swap any dish for any other until the Monday cut-off.
          </p>
          <div className="mt-8">
            <MenuSection groups={NEXT_WEEK} />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader
            eyebrow="All fourteen"
            title="Allergens, per dish"
            description="Contains, may contain, and does not — three different answers. A blanket 'prepared in a kitchen that handles nuts' is legally enough and helps nobody."
          />
          <div className="mt-8">
            <AllergenMatrix
              allergens={ALLERGENS}
              dishes={DISHES}
              askFor="Anything not listed, or a severe allergy: ring 0114 288 4410 and ask for the kitchen. Somebody who cooks the food will answer, not a call centre."
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            We cannot guarantee an allergen-free environment and we will not claim to. What we can
            do is tell you exactly which dishes share equipment, which is what "may contain" means
            here rather than a legal shrug.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Menu questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I have the same dish two weeks running?",
                  answer: "Yes — anything on the current menu can be repeated, and about a third of the list carries over each week anyway.",
                },
                {
                  question: "Do you cater for coeliacs?",
                  answer:
                    "We flag gluten honestly but we are not a gluten-free kitchen and flour is milled in the same room. For coeliac disease specifically, we would not recommend us, and we would rather say that than take the order.",
                },
                {
                  question: "How long do the ingredients keep?",
                  answer:
                    "Use-by dates are on everything. Fish and chicken are three days from delivery, everything else five or more. Cook the fish dish first — that is the only real rule.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">This week's ten</a>
            {" · "}
            <a className="underline underline-offset-4" href="/plans">Plans and prices</a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}

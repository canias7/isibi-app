import * as React from "react";
import { Input } from "@/components/ui/input";
import * as Lucide from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick an icon by name.
 *
 * A CURATED ~120 rather than lucide's 1,500. Importing them all defeats
 * tree-shaking and pulls the entire icon set into the bundle of a site that
 * uses four — the same reasoning as `emoji-picker`, and the cost here is much
 * larger.
 *
 * The value is the icon's NAME, not a component. A picker that hands back a
 * React element cannot store its result, and what this feeds is nearly always
 * a database column.
 */
export const ICON_NAMES = [
  "Home","User","Users","Settings","Search","Calendar","Clock","Mail","Phone","MapPin",
  "Star","Heart","Bookmark","Tag","Flag","Bell","Camera","Image","Video","Music",
  "File","FileText","Folder","Download","Upload","Link","Paperclip","Printer","Save","Trash2",
  "Edit","Copy","Scissors","Clipboard","Check","X","Plus","Minus","ChevronRight","ArrowRight",
  "ShoppingCart","ShoppingBag","CreditCard","Wallet","Receipt","Gift","Package","Truck","Store","Tags",
  "Lock","Unlock","Key","Shield","Eye","EyeOff","AlertTriangle","Info","HelpCircle","CheckCircle",
  "Coffee","Utensils","Pizza","Wine","Cake","Scissors as Cut","Sparkles","Flame","Leaf","Sun",
  "Moon","Cloud","Umbrella","Wind","Snowflake","Zap","Battery","Wifi","Globe","Compass",
  "Briefcase","Building2","Factory","Warehouse","Hammer","Wrench","Ruler","PenTool","Palette","Brush",
  "Activity","BarChart3","PieChart","TrendingUp","Target","Award","Trophy","Medal","Crown","Gem",
  "Play","Pause","Volume2","Mic","Headphones","Radio","Tv","Smartphone","Laptop","Monitor",
  "Car","Bike","Bus","Plane","Train","Ship","Anchor","Rocket","Navigation","Map",
].filter((n) => !n.includes(" as ")).filter((n, i, a) => a.indexOf(n) === i);
type IconMap = Record<string, React.ComponentType<{ className?: string }>>;
export function IconPicker({ value, onChange, className }: {
  value?: string | null; onChange: (name: string) => void; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const icons = Lucide as unknown as IconMap;
  // `typeof icons[n] === "function"` filtered out EVERY icon and the picker
  // rendered "nothing matches" with an empty query — lucide's exports are
  // React.forwardRef OBJECTS, not functions. Caught by looking at it; a
  // component that renders an empty grid typechecks perfectly.
  const exists = (n: string) => {
    const v = icons[n] as unknown;
    return typeof v === "function" || (typeof v === "object" && v !== null);
  };
  const shown = ICON_NAMES
    .filter(exists)
    .filter((n) => !q || n.toLowerCase().includes(q.toLowerCase().replace(/\s+/g, "")));
  return (
    <div className={cn("w-64 space-y-2 rounded-md border border-border bg-popover p-2 shadow-md", className)}>
      <Input value={q} placeholder="Search icons" aria-label="Search icons" className="h-8"
        onChange={(e) => setQ(e.target.value)} />
      <div className="grid max-h-56 grid-cols-7 gap-0.5 overflow-y-auto">
        {shown.map((name) => {
          const Icon = icons[name];
          return (
            <button key={name} type="button" onClick={() => onChange(name)} title={name} aria-label={name}
              aria-pressed={name === value}
              className={cn("grid cursor-pointer place-items-center rounded p-1.5 hover:bg-muted",
                name === value && "bg-muted ring-1 ring-foreground")}>
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
      {!shown.length && <p className="py-4 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</p>}
    </div>
  );
}

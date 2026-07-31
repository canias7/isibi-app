import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OpentypeFeatures } from "@/components/charts/lib/typography"
const faces = ["Light", "Regular", "Medium", "Bold", "Black"]
const features = [
  { tag: "kern", name: "kerning" },
  { tag: "liga", name: "ligatures" },
  { tag: "onum", name: "old-style figures" },
  { tag: "tnum", name: "tabular figures" },
  { tag: "frac", name: "fractions" },
  { tag: "smcp", name: "small caps" },
  { tag: "ss01", name: "alt a" },
]
const supported = [
  [true, true, false, true, false, false, false],
  [true, true, true, true, true, true, true],
  [true, true, true, true, true, true, false],
  [true, true, true, true, true, false, false],
  [true, true, false, true, false, false, false],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenType coverage</CardTitle>
        <CardDescription>Which faces actually ship each feature</CardDescription>
      </CardHeader>
      <CardContent>
        <OpentypeFeatures faces={faces} features={features} supported={supported} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A gap shows up as one weight looking wrong <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Family audit
        </div>
      </CardFooter>
    </Card>
  )
}

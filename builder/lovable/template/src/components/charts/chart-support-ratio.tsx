import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SupportRatio } from "@/components/charts/lib/additive"
const orientations = [
  // a flat part needs the most ANCHORING (it is one long unsupported span over
  // the plate) and an upright one the least volume of it — but the upright's
  // supports sit in a bore, so they cost the most per cm³ to grind out. Volume
  // and removal time are not proportional, which is the whole point of the card
  { name: "Flat on the plate", partCm3: 62, supportCm3: 34, removalHours: 1.9, heightMm: 22, risk: "high" as const },
  { name: "45° A", partCm3: 62, supportCm3: 31, removalHours: 1.6, heightMm: 68, risk: "low" as const },
  { name: "45° B", partCm3: 62, supportCm3: 26, removalHours: 1.0, heightMm: 71, risk: "low" as const },
  { name: "Upright", partCm3: 62, supportCm3: 14, removalHours: 2.1, heightMm: 96, risk: "medium" as const },
  { name: "Nested pair", partCm3: 62, supportCm3: 44, removalHours: 2.4, heightMm: 54, risk: "low" as const },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supports</CardTitle>
        <CardDescription>Paid for in powder and again at the bench</CardDescription>
      </CardHeader>
      <CardContent>
        <SupportRatio orientations={orientations} materialCostPerCm3={0.62} finishingCostPerHour={48} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The risk glyph is the fourth axis and no cost model has it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One part, five orientations
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MeritOrder } from "@/components/charts/lib/power"
const plants = [
  { name: "Wind", mw: 9200, costPerMwh: 0 },
  { name: "Solar", mw: 3100, costPerMwh: 0 },
  { name: "Nuclear", mw: 6400, costPerMwh: 12 },
  { name: "Hydro", mw: 1800, costPerMwh: 18 },
  { name: "Biomass", mw: 2200, costPerMwh: 54 },
  { name: "CCGT", mw: 11000, costPerMwh: 78 },
  { name: "OCGT", mw: 3400, costPerMwh: 165 },
  { name: "Diesel", mw: 900, costPerMwh: 310 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatch</CardTitle>
        <CardDescription>Cheapest first, until demand is met</CardDescription>
      </CardHeader>
      <CardContent>
        <MeritOrder plants={plants} demand={26500} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The last plant needed sets everyone's price <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One half-hour
        </div>
      </CardFooter>
    </Card>
  )
}

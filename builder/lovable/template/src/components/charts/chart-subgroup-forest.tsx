import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuantileDotPlot, IconArray, SurvivalBand, CumulativeIncidence, SubgroupForest, DecisionCurve, UpliftCurve, PowerCurve } from "./lib/stats3"

const groups = [
  { label: "By channel", rows: [
    { label: "Online", estimate: 1.34, low: 1.12, high: 1.6 },
    { label: "Phone", estimate: 1.21, low: 0.98, high: 1.5 },
    { label: "Walk-in", estimate: 1.44, low: 1.02, high: 2.03 },
  ] },
  { label: "By tenure", rows: [
    { label: "Under 6m", estimate: 1.52, low: 1.2, high: 1.93 },
    { label: "Over 6m", estimate: 1.18, low: 1.01, high: 1.38 },
  ] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subgroup Forest</CardTitle>
        <CardDescription>Effect by subgroup, with an overall estimate.</CardDescription>
      </CardHeader>
      <CardContent>
        <SubgroupForest groups={groups} overall={{ estimate: 1.31, low: 1.18, high: 1.45 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The effect holds in every subgroup <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

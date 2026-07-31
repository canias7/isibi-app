import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SurvivalCurve, ForestPlot, FunnelPlot, BlandAltman, ResidualPlot, Correlogram, LagPlot, RegressionBand, LoessPlot, BinScatter, RugPlot, DotHistogram, SentimentTimeline, NgramLadder, rnd } from "./lib/statistical"

const cohorts = [
  { label: "Subscribers", points: [
    { t: 0, surviving: 1 }, { t: 1, surviving: 0.92 }, { t: 2, surviving: 0.84 },
    { t: 3, surviving: 0.76 }, { t: 4, surviving: 0.68 }, { t: 6, surviving: 0.54 },
    { t: 8, surviving: 0.46 }, { t: 12, surviving: 0.38 },
  ] },
  { label: "Pay as you go", points: [
    { t: 0, surviving: 1 }, { t: 1, surviving: 0.74 }, { t: 2, surviving: 0.58 },
    { t: 3, surviving: 0.44 }, { t: 4, surviving: 0.36 }, { t: 6, surviving: 0.24 },
    { t: 8, surviving: 0.18 }, { t: 12, surviving: 0.12 },
  ] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Survival Curve</CardTitle>
        <CardDescription>Customers still returning, month by month.</CardDescription>
      </CardHeader>
      <CardContent>
        <SurvivalCurve cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half are still active at month 6 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

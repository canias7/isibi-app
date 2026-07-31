import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AnomalyBand, ChangePoint, SeasonalPolar, RasterPlot, RunwayChart, QueueWait, CapacityDemand, LtvCurve, PaybackPeriod, NpsDistribution, MarginBridge, PriceVolumeMix, DiscountLadder, AttachRate, ChurnReasons, WindRose, CriticalPath } from "./lib/ops"

const cohorts = [
  { label: "Subscribers", values: [24, 46, 68, 89, 109, 128, 148, 166, 204, 221, 236, 250] },
  { label: "Pay as you go", values: [24, 41, 54, 63, 70, 76, 80, 84, 87, 89, 91, 92] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LTV Curve</CardTitle>
        <CardDescription>Cumulative revenue per customer.</CardDescription>
      </CardHeader>
      <CardContent>
        <LtvCurve cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Subscribers pass £200 by month nine <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

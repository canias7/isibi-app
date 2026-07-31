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

const drivers = [
  { label: "Price", value: 1.8 },
  { label: "Staff cost", value: -2.4 },
  { label: "Stock", value: 0.9 },
  { label: "Mix", value: 1.2 },
  { label: "Waste", value: -0.6 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Margin Bridge</CardTitle>
        <CardDescription>What moved the margin between periods.</CardDescription>
      </CardHeader>
      <CardContent>
        <MarginBridge from={31.4} to={33.7} drivers={drivers} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Staff cost took 2.4 points <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

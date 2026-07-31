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

const periods = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const demand = [22, 18, 26, 31, 44, 62]
const capacity = [34, 34, 34, 34, 38, 38]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity and Demand</CardTitle>
        <CardDescription>What we could not serve, outlined.</CardDescription>
      </CardHeader>
      <CardContent>
        <CapacityDemand periods={periods} demand={demand} capacity={capacity} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Turned away 24 on Saturday <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

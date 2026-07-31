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
const arrivals = [22, 18, 26, 31, 44, 52]
const served = [22, 18, 26, 29, 34, 38]
const waits = [2, 1, 3, 6, 18, 24]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue and Wait</CardTitle>
        <CardDescription>Arrivals against what we could serve.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueueWait periods={periods} arrivals={arrivals} served={served} waits={waits} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Friday is where the wait builds <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

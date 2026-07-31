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

const values = [
  31, 29, 34, 30, 33, 28, 32, 30, 35, 31,
  41, 44, 39, 43, 45, 40, 42, 46, 41, 44,
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Point</CardTitle>
        <CardDescription>Where the level actually shifted.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePoint values={values} at={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Up 9 a day after the refit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

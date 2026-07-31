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

const labels = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"]
const cumulative = [-62, -48, -34, -21, -9, 4, 18, 33, 49, 66]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payback Period</CardTitle>
        <CardDescription>When acquisition cost is repaid.</CardDescription>
      </CardHeader>
      <CardContent>
        <PaybackPeriod cumulative={cumulative} labels={labels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Repaid in month five <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

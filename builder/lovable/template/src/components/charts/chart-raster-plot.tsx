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

const rows = [
  { label: "Chair 1", events: [9.2, 10, 10.8, 11.5, 13, 13.8, 14.6, 15.5, 16.2, 17] },
  { label: "Chair 2", events: [9.5, 11, 12.2, 14, 15.4, 16.8] },
  { label: "Chair 3", events: [10.4, 12.6, 15, 17.2] },
  { label: "Chair 4", events: [9.1, 9.8, 11.2, 12, 13.4, 14.2, 16] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Raster Plot</CardTitle>
        <CardDescription>One row per chair, one mark per booking.</CardDescription>
      </CardHeader>
      <CardContent>
        <RasterPlot rows={rows} span={[9, 18]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Chair 1 runs solid through the afternoon <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

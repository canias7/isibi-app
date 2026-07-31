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

const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
const bands = ["Under 1km", "1-3km", "3-6km", "Over 6km"]
const values = [
  [8, 6, 3, 1], [5, 4, 2, 1], [4, 3, 2, 1], [7, 6, 4, 2],
  [11, 9, 5, 2], [16, 14, 9, 4], [9, 7, 4, 2], [6, 5, 3, 1],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wind Rose</CardTitle>
        <CardDescription>Frequency by direction, stacked by band.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <WindRose directions={directions} bands={bands} values={values} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most arrivals come from the south west <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

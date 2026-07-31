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

const years = [
  { label: "2022", values: [18, 17, 20, 23, 27, 31, 33, 32, 26, 22, 20, 25] },
  { label: "2023", values: [20, 19, 23, 26, 31, 35, 38, 36, 29, 25, 23, 29] },
  { label: "2024", values: [23, 21, 26, 30, 35, 41, 44, 42, 34, 29, 26, 33] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seasonal Polar</CardTitle>
        <CardDescription>Months on a circle, one ring per year.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SeasonalPolar years={years} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The summer peak keeps growing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

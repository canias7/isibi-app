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

const reasons = [
  { label: "Waiting time", count: 38, recoverable: true },
  { label: "Price", count: 29, recoverable: true },
  { label: "Moved away", count: 24, recoverable: false },
  { label: "Booking hassle", count: 18, recoverable: true },
  { label: "Went elsewhere", count: 14, recoverable: true },
  { label: "No longer needed", count: 9, recoverable: false },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Churn Reasons</CardTitle>
        <CardDescription>Why people left, and which we could fix.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChurnReasons reasons={reasons} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Over half was something we controlled <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

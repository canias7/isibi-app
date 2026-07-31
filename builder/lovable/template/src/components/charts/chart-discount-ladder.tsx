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

const bands = [
  { label: "None", orders: 412, revenue: 9880, cost: 0 },
  { label: "10%", orders: 186, revenue: 4020, cost: 447 },
  { label: "20%", orders: 94, revenue: 1810, cost: 452 },
  { label: "30%", orders: 41, revenue: 690, cost: 296 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Discount Ladder</CardTitle>
        <CardDescription>What each band brings in and gives away.</CardDescription>
      </CardHeader>
      <CardContent>
        <DiscountLadder bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The 30% band barely pays for itself <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const expected = Array.from({ length: 30 }, (_, i) => 40 + Math.sin(i / 4) * 8)
const tolerance = expected.map(() => 9)
const values = expected.map((e, i) => e + (i === 11 ? 26 : i === 22 ? -21 : ((i * 37) % 9) - 4))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Band</CardTitle>
        <CardDescription>A series against what was expected.</CardDescription>
      </CardHeader>
      <CardContent>
        <AnomalyBand values={values} expected={expected} tolerance={tolerance} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two days fell outside the band <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const base = { label: "haircuts", count: 412 }
const addons = [
  { label: "Wash", count: 168 },
  { label: "Beard trim", count: 121 },
  { label: "Hot towel", count: 74 },
  { label: "Product", count: 52 },
  { label: "Colour", count: 19 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attach Rate</CardTitle>
        <CardDescription>What gets sold alongside a haircut.</CardDescription>
      </CardHeader>
      <CardContent>
        <AttachRate base={base} addons={addons} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two in five add a wash <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

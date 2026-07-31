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

const tasks = [
  { id: "brief", name: "Brief", duration: 2 },
  { id: "design", name: "Design", duration: 4, after: ["brief"] },
  { id: "copy", name: "Copy", duration: 3, after: ["brief"] },
  { id: "build", name: "Build", duration: 5, after: ["design"] },
  { id: "photos", name: "Photos", duration: 2, after: ["brief"] },
  { id: "review", name: "Review", duration: 2, after: ["build", "copy"] },
  { id: "launch", name: "Launch", duration: 1, after: ["review"] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Critical Path</CardTitle>
        <CardDescription>The chain that decides the finish date.</CardDescription>
      </CardHeader>
      <CardContent>
        <CriticalPath tasks={tasks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Fourteen days, and review is on the path <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

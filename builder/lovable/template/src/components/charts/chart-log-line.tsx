import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClevelandDotPlot, GroupedDotPlot, IndexChart, LogLine, PercentChangeBar, BubbleGrid, TallyChart, DeltaBars, MosaicPlot, PPPlot, BootstrapCI, InfluencePlot, ScaleLocation, PartialDependence } from "./lib/comparison2"

const periods = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"]
const series = [
  { label: "Bookings", values: [40, 58, 84, 122, 176, 255, 370, 536] },
  { label: "Linear comparison", values: [40, 110, 180, 250, 320, 390, 460, 530] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Line</CardTitle>
        <CardDescription>A log axis, where constant growth is a straight line.</CardDescription>
      </CardHeader>
      <CardContent>
        <LogLine series={series} periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Steady percentage growth throughout <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

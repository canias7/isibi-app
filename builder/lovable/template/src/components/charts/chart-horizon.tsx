import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Horizon, CyclePlot, CohortGrid, Burndown, RunChart, EventTimeline, Swimlane, SmallMultiples, SpiralPlot } from "./lib/timeline"

const series = [
  { label: "Haircut", values: [42, 51, 47, 55, 61, 58, 64, 69, 62, 71, 68, 74] },
  { label: "Beard", values: [31, 28, 34, 30, 27, 33, 29, 26, 31, 28, 25, 30] },
  { label: "Colour", values: [12, 14, 18, 46, 51, 33, 22, 19, 24, 27, 31, 29] },
  { label: "Towel", values: [18, 16, 19, 21, 17, 20, 22, 18, 16, 19, 21, 23] },
  { label: "Kids", values: [9, 11, 8, 12, 14, 10, 9, 13, 15, 11, 10, 12] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Horizon</CardTitle>
        <CardDescription>Six series in the height of two.</CardDescription>
      </CardHeader>
      <CardContent>
        <Horizon series={series} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour spikes in April <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const panels = [
  { label: "Haircut", values: [42, 51, 47, 55, 61, 58, 64, 69] },
  { label: "Beard", values: [31, 28, 34, 30, 27, 33, 29, 26] },
  { label: "Colour", values: [12, 14, 18, 26, 31, 38, 44, 51] },
  { label: "Towel", values: [18, 16, 19, 21, 17, 20, 22, 18] },
  { label: "Kids", values: [9, 11, 8, 12, 14, 10, 9, 13] },
  { label: "Wash", values: [24, 26, 23, 27, 25, 28, 26, 29] },
  { label: "Shave", values: [15, 13, 16, 14, 12, 15, 13, 14] },
  { label: "Trim", values: [21, 23, 20, 24, 22, 25, 23, 26] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Small Multiples</CardTitle>
        <CardDescription>The same chart per service, one shared scale.</CardDescription>
      </CardHeader>
      <CardContent>
        <SmallMultiples panels={panels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Only Colour is really growing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

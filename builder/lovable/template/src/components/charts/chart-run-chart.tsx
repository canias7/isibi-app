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

const values = [42, 39, 44, 41, 43, 38, 40, 47, 49, 51, 48, 52, 50, 53, 49, 44]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Chart</CardTitle>
        <CardDescription>A measure against its median, with runs marked.</CardDescription>
      </CardHeader>
      <CardContent>
        <RunChart values={values} format={(n) => n + "m"} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A run of seven — something changed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

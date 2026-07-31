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

const actual = [48, 46, 43, 41, 40, 36, 33, 31, 26, 22, 19, 13, 8, 3]
const days = ["Day 1", "Day 14"]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Burndown</CardTitle>
        <CardDescription>Work left against the straight line to zero.</CardDescription>
      </CardHeader>
      <CardContent>
        <Burndown actual={actual} total={48} days={days} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two days behind the ideal <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

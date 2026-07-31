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

const values = [
  32, 28, 41, 48, 62, 78, 91, 88, 64, 51, 44, 58,
  36, 31, 45, 53, 68, 84, 97, 94, 70, 56, 48, 63,
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spiral Plot</CardTitle>
        <CardDescription>Two years of bookings wound outwards.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SpiralPlot values={values} perTurn={12} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The same summer peak, twice <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

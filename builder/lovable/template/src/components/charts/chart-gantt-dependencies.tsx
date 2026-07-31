import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Splom, Ternary, PolarScatter, VectorField, GlyphPlot, OHLC, DepthChart, FlowMap, ValueCartogram, GanttDeps } from "./lib/special"

const ticks = ["Week 1", "Week 2", "Week 3", "Week 4"]
const tasks = [
  { id: "design", name: "Design", start: 0, end: 1.2 },
  { id: "build", name: "Build", start: 1.2, end: 2.6, after: ["design"] },
  { id: "content", name: "Content", start: 1.2, end: 2.2, after: ["design"] },
  { id: "review", name: "Review", start: 2.6, end: 3.2, after: ["build", "content"] },
  { id: "launch", name: "Launch", start: 3.2, end: 3.7, after: ["review"] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gantt with Dependencies</CardTitle>
        <CardDescription>What is waiting on what.</CardDescription>
      </CardHeader>
      <CardContent>
        <GanttDeps tasks={tasks} ticks={ticks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Review blocks the launch <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

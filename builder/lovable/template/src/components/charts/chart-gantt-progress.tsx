import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Gantt } from "./lib/gantt"

const ticks = ["Week 1", "Week 2", "Week 3", "Week 4"]
const tasks = [
  { name: "Design", start: 0, end: 1.2, done: 100 },
  { name: "Build", start: 1, end: 2.6, done: 60 },
  { name: "Content", start: 1.8, end: 2.9, done: 35, tone: "muted" as const },
  { name: "Review", start: 2.6, end: 3.2, tone: "outline" as const },
  { name: "Launch", start: 3.2, end: 3.6 },
]
const solo = tasks.map((t) => ({ ...t, lane: t.name }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gantt</CardTitle>
        <CardDescription>One row per task, progress inside each bar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Gantt tasks={solo} ticks={ticks} min={0} max={4} rowHeight={32} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Build is 60% done <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const ticks = ["9am", "11am", "1pm", "3pm", "5pm"]
const tasks = [
  { name: "Cut · Ada", lane: "Chair 1", start: 0, end: 1.5 },
  { name: "Colour · Mo", lane: "Chair 1", start: 2, end: 4.5 },
  { name: "Cut · Sam", lane: "Chair 1", start: 5, end: 6.5 },
  { name: "Beard · Rae", lane: "Chair 2", start: 0.5, end: 1.5, tone: "muted" as const },
  { name: "Cut · Jo", lane: "Chair 2", start: 2.5, end: 4, tone: "muted" as const },
  { name: "Towel · Kit", lane: "Chair 3", start: 1, end: 2, tone: "outline" as const },
  { name: "Cut · Lee", lane: "Chair 3", start: 3.5, end: 5, tone: "outline" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gantt</CardTitle>
        <CardDescription>A day across three chairs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Gantt tasks={tasks} ticks={ticks} min={0} max={8} today={3.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Chair 1 is fully booked <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

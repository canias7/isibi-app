import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PianoRoll, YearWheel, DayStrip, EraTimeline, DynamicsChart } from "./lib/timeuse"

const events = [
  { label: "New year offer", from: 0, to: 1, ring: 0 },
  { label: "Wedding season", from: 4, to: 7, ring: 1 },
  { label: "Back to school", from: 7, to: 8, ring: 0 },
  { label: "Christmas", from: 10, to: 11, ring: 2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Year Wheel</CardTitle>
        <CardDescription>The year as a ring of campaigns.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <YearWheel events={events} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing planned for the autumn yet <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

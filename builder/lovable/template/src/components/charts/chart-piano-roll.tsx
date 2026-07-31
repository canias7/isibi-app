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

const notes = [
  { pitch: 60, start: 0, duration: 1 }, { pitch: 64, start: 1, duration: 1 },
  { pitch: 67, start: 2, duration: 1.5 }, { pitch: 65, start: 3.5, duration: 0.5 },
  { pitch: 64, start: 4, duration: 1 }, { pitch: 62, start: 5, duration: 1 },
  { pitch: 60, start: 6, duration: 2 }, { pitch: 55, start: 6, duration: 2, velocity: 0.5 },
  { pitch: 67, start: 8, duration: 1 }, { pitch: 69, start: 9, duration: 1 },
  { pitch: 71, start: 10, duration: 1 }, { pitch: 72, start: 11, duration: 3 },
  { pitch: 52, start: 8, duration: 3, velocity: 0.4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Piano Roll</CardTitle>
        <CardDescription>Notes as bars, pitch up, beats across.</CardDescription>
      </CardHeader>
      <CardContent>
        <PianoRoll notes={notes} beats={14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rising four-bar phrase <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

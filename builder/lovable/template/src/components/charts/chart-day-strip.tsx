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

const segments = [
  { from: 0, to: 8, label: "Closed", tone: 0.08 },
  { from: 8, to: 9, label: "Set up", tone: 0.3 },
  { from: 9, to: 13, label: "Clients", tone: 0.8 },
  { from: 13, to: 14, label: "Lunch", tone: 0.2 },
  { from: 14, to: 18, label: "Clients", tone: 0.8 },
  { from: 18, to: 19, label: "Admin", tone: 0.45 },
  { from: 19, to: 24, label: "Closed", tone: 0.08 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Day Strip</CardTitle>
        <CardDescription>One day, banded by what fills it.</CardDescription>
      </CardHeader>
      <CardContent>
        <DayStrip segments={segments} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cutting time is barely half the day <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

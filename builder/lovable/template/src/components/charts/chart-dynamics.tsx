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

const lufs = Array.from({ length: 80 }, (_, i) => {
  const section = i < 12 ? -24 : i < 34 ? -14 : i < 46 ? -22 : i < 70 ? -11 : -18
  return section + Math.sin(i * 1.7) * 1.6
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dynamics</CardTitle>
        <CardDescription>Loudness through the piece.</CardDescription>
      </CardHeader>
      <CardContent>
        <DynamicsChart lufs={lufs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A quiet middle eight before the last chorus <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

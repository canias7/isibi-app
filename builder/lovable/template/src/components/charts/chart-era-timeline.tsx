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

const eras = [
  { label: "First premises", from: 2014, to: 2019 },
  { label: "Market stall", from: 2017, to: 2021 },
  { label: "High street shop", from: 2019, to: 2026 },
  { label: "Online booking", from: 2020, to: 2026 },
  { label: "Second chair", from: 2022, to: 2026 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Era Timeline</CardTitle>
        <CardDescription>Overlapping spans packed into lanes.</CardDescription>
      </CardHeader>
      <CardContent>
        <EraTimeline eras={eras} span={[2014, 2026]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three tools in service at once <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

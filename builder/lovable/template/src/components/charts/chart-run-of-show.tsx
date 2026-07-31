import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RunOfShow } from "@/components/charts/lib/events"
const items = [
  { name: "Doors and walk-in", minutes: 45 },
  { name: "Support 1", minutes: 30, changeoverMinutes: 15 },
  { name: "Support 2", minutes: 35, changeoverMinutes: 25 },
  { name: "Headline", minutes: 95, fixed: true, changeoverMinutes: 0 },
  { name: "Encore", minutes: 12, fixed: true },
  { name: "Walk-out", minutes: 20 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run of show</CardTitle>
        <CardDescription>The float against the curfew</CardDescription>
      </CardHeader>
      <CardContent>
        <RunOfShow items={items} doorsMinute={1140} curfewMinute={1380} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Thirty-seven minutes past the curfew as laid out <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          23:00 curfew
        </div>
      </CardFooter>
    </Card>
  )
}

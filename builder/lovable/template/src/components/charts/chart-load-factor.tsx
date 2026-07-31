import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoadFactor } from "@/components/charts/lib/aviation"
const routes = [
  { name: "LHR–JFK", seats: 258, sold: 231, averageFare: 640, stageKm: 5560 },
  { name: "LHR–DUB", seats: 180, sold: 171, averageFare: 74, stageKm: 450 },
  { name: "LHR–SIN", seats: 292, sold: 218, averageFare: 810, stageKm: 10850 },
  { name: "MAN–AMS", seats: 156, sold: 118, averageFare: 96, stageKm: 490 },
  { name: "LHR–BCN", seats: 180, sold: 164, averageFare: 118, stageKm: 1150 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Load factor</CardTitle>
        <CardDescription>Each route against its own break-even</CardDescription>
      </CardHeader>
      <CardContent>
        <LoadFactor routes={routes} caskCents={6} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three quarters full and still short <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          CASK 6.0¢
        </div>
      </CardFooter>
    </Card>
  )
}

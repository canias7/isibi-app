import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CirculationFlow } from "@/components/charts/lib/building"
const zones = ["Entrance", "Atrium", "Lifts", "Stairs", "Level 2", "Level 5", "Canteen"]
const flows = [
  { from: "Entrance", to: "Atrium", perMin: 148 },
  { from: "Atrium", to: "Lifts", perMin: 96 },
  { from: "Atrium", to: "Stairs", perMin: 52 },
  { from: "Lifts", to: "Level 5", perMin: 61 },
  { from: "Lifts", to: "Level 2", perMin: 35 },
  { from: "Stairs", to: "Level 2", perMin: 44 },
  { from: "Level 2", to: "Canteen", perMin: 28 },
  { from: "Level 5", to: "Canteen", perMin: 34 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Circulation</CardTitle>
        <CardDescription>People per minute on each link at the peak</CardDescription>
      </CardHeader>
      <CardContent>
        <CirculationFlow zones={zones} flows={flows} corridorCapacityPerMin={80} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two links will queue at the peak <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Morning arrival
        </div>
      </CardFooter>
    </Card>
  )
}

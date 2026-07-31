import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HivePlot, Bipartite, VoronoiMap, FlameGraph, EdgeBundling, CoOccurrence } from "./lib/graphs"

const labels = ["Cut", "Beard", "Colour", "Wash", "Towel"]
const matrix = [
  [0, 0, 0, 0, 0],
  [24, 0, 0, 0, 0],
  [9, 4, 0, 0, 0],
  [38, 12, 15, 0, 0],
  [14, 19, 3, 8, 0],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Co-occurrence</CardTitle>
        <CardDescription>How often two services are booked together.</CardDescription>
      </CardHeader>
      <CardContent>
        <CoOccurrence labels={labels} matrix={matrix} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut and wash is the strongest pair <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

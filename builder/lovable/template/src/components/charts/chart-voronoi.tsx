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

const sites = [
  { label: "North", x: 0.32, y: 0.22 },
  { label: "East", x: 0.78, y: 0.44 },
  { label: "South", x: 0.46, y: 0.82 },
  { label: "West", x: 0.14, y: 0.62 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voronoi</CardTitle>
        <CardDescription>Which branch each street is nearest.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <VoronoiMap sites={sites} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The north branch covers most ground <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Splom, Ternary, PolarScatter, VectorField, GlyphPlot, OHLC, DepthChart, FlowMap, ValueCartogram, GanttDeps } from "./lib/special"

const places = [
  { id: "NW", row: 0, col: 1 }, { id: "NE", row: 0, col: 3 },
  { id: "W", row: 1, col: 0 }, { id: "C", row: 1, col: 2 }, { id: "E", row: 1, col: 4 },
  { id: "SW", row: 2, col: 1 }, { id: "SE", row: 2, col: 3 },
]
const flows = [
  { from: "NW", to: "C", value: 62 },
  { from: "NE", to: "C", value: 41 },
  { from: "W", to: "C", value: 28 },
  { from: "E", to: "C", value: 34 },
  { from: "SW", to: "C", value: 19 },
  { from: "SE", to: "C", value: 12 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow Map</CardTitle>
        <CardDescription>Where customers travel in from.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <FlowMap places={places} flows={flows} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most come from the two nearest areas <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

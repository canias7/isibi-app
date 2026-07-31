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

const regions = [
  { id: "SCO", row: 0, col: 2, value: 62 },
  { id: "NI", row: 1, col: 0, value: 24 },
  { id: "NE", row: 1, col: 3, value: 48 },
  { id: "NW", row: 2, col: 2, value: 96 },
  { id: "YH", row: 2, col: 3, value: 71 },
  { id: "WAL", row: 3, col: 1, value: 39 },
  { id: "WM", row: 3, col: 2, value: 84 },
  { id: "EM", row: 3, col: 3, value: 66 },
  { id: "EE", row: 3, col: 4, value: 58 },
  { id: "SW", row: 4, col: 1, value: 52 },
  { id: "LON", row: 4, col: 3, value: 190 },
  { id: "SE", row: 4, col: 4, value: 102 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Value Cartogram</CardTitle>
        <CardDescription>Tiles sized by value, not shaded by it.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ValueCartogram regions={regions} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          London dwarfs the rest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const bars = [
  { label: "D1", open: 42.1, high: 43.8, low: 41.6, close: 43.2 },
  { label: "D2", open: 43.2, high: 44.9, low: 42.8, close: 42.9 },
  { label: "D3", open: 42.9, high: 43.4, low: 41.2, close: 41.7 },
  { label: "D4", open: 41.7, high: 43.1, low: 41.5, close: 42.8 },
  { label: "D5", open: 42.8, high: 45.2, low: 42.6, close: 44.9 },
  { label: "D6", open: 44.9, high: 45.6, low: 43.9, close: 44.1 },
  { label: "D7", open: 44.1, high: 46.3, low: 44.0, close: 46.1 },
  { label: "D8", open: 46.1, high: 47.2, low: 45.4, close: 45.8 },
  { label: "D9", open: 45.8, high: 46.4, low: 44.2, close: 44.6 },
  { label: "D10", open: 44.6, high: 47.8, low: 44.5, close: 47.3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OHLC Bars</CardTitle>
        <CardDescription>The other financial notation — no fill needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <OHLC bars={bars} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Closed the fortnight up <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

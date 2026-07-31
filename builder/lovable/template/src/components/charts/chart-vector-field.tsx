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

const vectors = Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 10 }, (_, c) => ({
    x: (c + 0.5) / 10,
    y: (r + 0.5) / 8,
    angle: 20 + c * 6 + r * 4,
    magnitude: 1 + ((c + r) % 5),
  }))
).flat()

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vector Field</CardTitle>
        <CardDescription>Direction and strength across a grid.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <VectorField vectors={vectors} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Flow runs to the top right <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

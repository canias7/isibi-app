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

const bids = [
  { price: 44.0, size: 12 }, { price: 43.8, size: 18 }, { price: 43.5, size: 26 },
  { price: 43.1, size: 31 }, { price: 42.6, size: 44 }, { price: 42.0, size: 58 },
]
const asks = [
  { price: 44.3, size: 9 }, { price: 44.6, size: 15 }, { price: 45.0, size: 21 },
  { price: 45.5, size: 24 }, { price: 46.1, size: 30 }, { price: 46.8, size: 36 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Depth Chart</CardTitle>
        <CardDescription>Cumulative interest either side of the mid price.</CardDescription>
      </CardHeader>
      <CardContent>
        <DepthChart bids={bids} asks={asks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Thicker on the bid <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

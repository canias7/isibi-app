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

const keys = ["price", "minutes", "rating", "repeat"]
const rows = [
  { label: "Cut", values: { price: 24, minutes: 35, rating: 4.6, repeat: 68 } },
  { label: "Beard", values: { price: 14, minutes: 20, rating: 4.4, repeat: 54 } },
  { label: "Colour", values: { price: 62, minutes: 95, rating: 4.8, repeat: 41 } },
  { label: "Towel", values: { price: 18, minutes: 25, rating: 4.2, repeat: 33 } },
  { label: "Kids", values: { price: 16, minutes: 25, rating: 4.5, repeat: 72 } },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Glyph Plot</CardTitle>
        <CardDescription>One small radar per service — compare by silhouette.</CardDescription>
      </CardHeader>
      <CardContent>
        <GlyphPlot keys={keys} rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour is the odd shape out <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

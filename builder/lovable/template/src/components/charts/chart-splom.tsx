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
const labels = { price: "Price", minutes: "Minutes", rating: "Rating", repeat: "Repeat %" }
const rows = [
  { price: 24, minutes: 35, rating: 4.6, repeat: 68 },
  { price: 14, minutes: 20, rating: 4.4, repeat: 54 },
  { price: 62, minutes: 95, rating: 4.8, repeat: 41 },
  { price: 18, minutes: 25, rating: 4.2, repeat: 33 },
  { price: 16, minutes: 25, rating: 4.5, repeat: 72 },
  { price: 9, minutes: 15, rating: 4.1, repeat: 60 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scatterplot Matrix</CardTitle>
        <CardDescription>Every pair of measures at once.</CardDescription>
      </CardHeader>
      <CardContent>
        <Splom keys={keys} rows={rows} labels={labels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Price and minutes move together <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

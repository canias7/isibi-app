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

const points = [
  { angle: 30, radius: 1.2, label: "9am · 1.2km" },
  { angle: 75, radius: 2.4, label: "11am · 2.4km" },
  { angle: 120, radius: 4.1, label: "1pm · 4.1km" },
  { angle: 165, radius: 5.6, label: "3pm · 5.6km" },
  { angle: 210, radius: 3.8, label: "5pm · 3.8km" },
  { angle: 255, radius: 2.1, label: "7pm · 2.1km" },
  { angle: 300, radius: 1.4, label: "9pm · 1.4km" },
  { angle: 345, radius: 0.9, label: "11pm · 0.9km" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Polar Scatter</CardTitle>
        <CardDescription>Bookings by time of day and distance travelled.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <PolarScatter points={points} angleLabels={["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"]} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Afternoons draw from further away <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

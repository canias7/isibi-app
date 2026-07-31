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
  { label: "Mon", a: 62, b: 28, c: 10 },
  { label: "Wed", a: 54, b: 31, c: 15 },
  { label: "Fri", a: 41, b: 36, c: 23 },
  { label: "Sat", a: 22, b: 30, c: 48 },
  { label: "Sun", a: 70, b: 20, c: 10 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ternary</CardTitle>
        <CardDescription>How each day splits three ways.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Ternary points={points} corners={["Booked", "Phone", "Walk-in"]} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday is nearly all walk-ins <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

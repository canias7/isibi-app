import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SurvivalCurve, ForestPlot, FunnelPlot, BlandAltman, ResidualPlot, Correlogram, LagPlot, RegressionBand, LoessPlot, BinScatter, RugPlot, DotHistogram, SentimentTimeline, NgramLadder, rnd } from "./lib/statistical"

const r = rnd(19)
const points = Array.from({ length: 90 }, () => {
  const x = r() * 60 + 5
  return { x, y: 12 + x * 0.9 + (r() + r() - 1) * 18 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Binned Scatter</CardTitle>
        <CardDescription>The mean of each slice, not every point.</CardDescription>
      </CardHeader>
      <CardContent>
        <BinScatter points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The relationship is close to linear <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

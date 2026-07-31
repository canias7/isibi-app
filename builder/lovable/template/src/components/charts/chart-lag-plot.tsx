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

const r = rnd(31)
const noisy = Array.from({ length: 60 }, (_, i) => 40 + Math.sin(i / 5) * 12 + (r() - 0.5) * 10)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lag Plot</CardTitle>
        <CardDescription>Each day against the day before.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <LagPlot values={noisy} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tight to the line — strongly autocorrelated <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

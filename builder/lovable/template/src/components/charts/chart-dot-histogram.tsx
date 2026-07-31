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

const r = rnd(97)
const values = Array.from({ length: 140 }, () => Math.round(40 + ((r() + r() + r()) / 3 - 0.5) * 60))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dot Histogram</CardTitle>
        <CardDescription>One dot per appointment, stacked.</CardDescription>
      </CardHeader>
      <CardContent>
        <DotHistogram values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most cluster around 40 minutes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

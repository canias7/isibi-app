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

const points = [
  { label: "W1", score: 0.42 }, { label: "W2", score: 0.51 }, { label: "W3", score: 0.38 },
  { label: "W4", score: 0.12 }, { label: "W5", score: -0.18 }, { label: "W6", score: -0.31 },
  { label: "W7", score: -0.06 }, { label: "W8", score: 0.22 }, { label: "W9", score: 0.44 },
  { label: "W10", score: 0.58 }, { label: "W11", score: 0.61 }, { label: "W12", score: 0.55 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Timeline</CardTitle>
        <CardDescription>How reviews felt, week by week.</CardDescription>
      </CardHeader>
      <CardContent>
        <SentimentTimeline points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Recovered after the April dip <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const terms = [
  { text: "really friendly", value: 84 }, { text: "great cut", value: 71 },
  { text: "very clean", value: 66 }, { text: "good value", value: 52 },
  { text: "easy to book", value: 47 }, { text: "worth the wait", value: 39 },
  { text: "best in town", value: 35 }, { text: "lovely staff", value: 31 },
  { text: "quick and tidy", value: 28 }, { text: "will be back", value: 24 },
  { text: "no parking", value: 19 }, { text: "bit pricey", value: 14 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>N-gram Ladder</CardTitle>
        <CardDescription>The phrases reviews actually use.</CardDescription>
      </CardHeader>
      <CardContent>
        <NgramLadder terms={terms} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          \u201cReally friendly\u201d leads <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

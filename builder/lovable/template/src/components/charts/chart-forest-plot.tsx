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

const rows = [
  { label: "Reminder email", estimate: 0.34, low: 0.18, high: 0.5, weight: 9 },
  { label: "New photos", estimate: 0.12, low: -0.04, high: 0.28, weight: 6 },
  { label: "Shorter form", estimate: 0.21, low: -0.02, high: 0.44, weight: 4 },
  { label: "Price change", estimate: -0.08, low: -0.29, high: 0.13, weight: 5 },
  { label: "Live chat", estimate: 0.05, low: -0.19, high: 0.29, weight: 3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forest Plot</CardTitle>
        <CardDescription>Effect of each change, with its interval.</CardDescription>
      </CardHeader>
      <CardContent>
        <ForestPlot rows={rows} format={(n) => n.toFixed(2)} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Only the reminder email clears zero <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

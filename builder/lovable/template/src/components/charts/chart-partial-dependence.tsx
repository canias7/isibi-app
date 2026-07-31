import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClevelandDotPlot, GroupedDotPlot, IndexChart, LogLine, PercentChangeBar, BubbleGrid, TallyChart, DeltaBars, MosaicPlot, PPPlot, BootstrapCI, InfluencePlot, ScaleLocation, PartialDependence } from "./lib/comparison2"

function rnd(seed = 1) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 100000) / 100000 }
}

const r = rnd(113)
const points = Array.from({ length: 40 }, (_, i) => {
  const x = 10 + (i / 39) * 80
  return { x, y: 0.2 + 0.5 * (1 - Math.exp(-(x - 10) / 22)) }
})
const rug = Array.from({ length: 90 }, () => 10 + Math.pow(r(), 1.5) * 70)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partial Dependence</CardTitle>
        <CardDescription>What the model predicts as one input moves.</CardDescription>
      </CardHeader>
      <CardContent>
        <PartialDependence points={points} rug={rug} format={(n) => n.toFixed(0) + "m"} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Flattens past 45 minutes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

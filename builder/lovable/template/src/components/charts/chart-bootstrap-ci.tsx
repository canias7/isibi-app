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

const r = rnd(71)
const samples = Array.from({ length: 900 }, () => 0.34 + ((r() + r() + r()) / 3 - 0.5) * 0.32)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bootstrap Interval</CardTitle>
        <CardDescription>A resampled statistic, with its 95% interval.</CardDescription>
      </CardHeader>
      <CardContent>
        <BootstrapCI samples={samples} observed={0.34} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The interval clears zero <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

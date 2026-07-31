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

const r = rnd(101)
const points = Array.from({ length: 120 }, () => {
  const fitted = 10 + r() * 70
  return { fitted, residual: (r() + r() - 1) * (2 + fitted / 12) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scale-Location</CardTitle>
        <CardDescription>Does the spread change with the fitted value?</CardDescription>
      </CardHeader>
      <CardContent>
        <ScaleLocation points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Spread widens at the top — worth a transform <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

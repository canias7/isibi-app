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

const r = rnd(89)
const points = Array.from({ length: 70 }, (_, i) => {
  const leverage = Math.pow(r(), 2) * 0.35 + 0.01
  const residual = (r() + r() - 1) * 2.6
  return { leverage, residual, cooks: Math.abs(leverage * residual * residual) / 3, label: "obs " + (i + 1) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Influence Plot</CardTitle>
        <CardDescription>Leverage against residual, bubble by influence.</CardDescription>
      </CardHeader>
      <CardContent>
        <InfluencePlot points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two points are doing a lot of the work <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

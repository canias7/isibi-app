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

const cols = ["Online", "Phone", "Walk-in"]
const rowLabels = ["Kept", "Moved", "Cancelled"]
const values = [
  [540, 52, 28],
  [228, 34, 18],
  [96, 18, 36],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mosaic Plot</CardTitle>
        <CardDescription>A contingency table with both dimensions to scale.</CardDescription>
      </CardHeader>
      <CardContent>
        <MosaicPlot cols={cols} rowLabels={rowLabels} values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Walk-ins cancel far more often <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

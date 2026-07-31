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

const items = [
  { label: "Haircut", before: 380, after: 412 },
  { label: "Beard", before: 291, after: 266 },
  { label: "Colour", before: 96, after: 184 },
  { label: "Towel", before: 150, after: 139 },
  { label: "Kids", before: 74, after: 88 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delta Bars</CardTitle>
        <CardDescription>Before and after, joined by the gap.</CardDescription>
      </CardHeader>
      <CardContent>
        <DeltaBars items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour moved furthest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

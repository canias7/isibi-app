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
  { label: "Haircut", a: 380, b: 412 },
  { label: "Beard", a: 291, b: 266 },
  { label: "Towel", a: 150, b: 139 },
  { label: "Colour", a: 96, b: 184 },
  { label: "Kids", a: 74, b: 88 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grouped Dot Plot</CardTitle>
        <CardDescription>Two periods per category.</CardDescription>
      </CardHeader>
      <CardContent>
        <GroupedDotPlot items={items} seriesLabels={["Last half", "This half"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour is the only real mover <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

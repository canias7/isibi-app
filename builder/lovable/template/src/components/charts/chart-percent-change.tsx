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
  { label: "Colour", change: 92 },
  { label: "Kids", change: 19 },
  { label: "Haircut", change: 8 },
  { label: "Wash", change: 3 },
  { label: "Towel", change: -7 },
  { label: "Beard", change: -9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Percent Change</CardTitle>
        <CardDescription>Movement per category, either side of zero.</CardDescription>
      </CardHeader>
      <CardContent>
        <PercentChangeBar items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour up 92%, beard down 9% <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

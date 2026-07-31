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

const periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
const series = [
  { label: "Colour", values: [96, 108, 124, 142, 166, 184] },
  { label: "Haircut", values: [380, 388, 394, 399, 406, 412] },
  { label: "Beard", values: [291, 286, 279, 274, 269, 266] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Index Chart</CardTitle>
        <CardDescription>Everything rebased to 100.</CardDescription>
      </CardHeader>
      <CardContent>
        <IndexChart series={series} periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour has nearly doubled <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

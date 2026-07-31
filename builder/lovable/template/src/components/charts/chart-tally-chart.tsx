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

const rows = [
  { label: "Mon", count: 7 },
  { label: "Tue", count: 4 },
  { label: "Wed", count: 11 },
  { label: "Thu", count: 14 },
  { label: "Fri", count: 19 },
  { label: "Sat", count: 23 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tally Chart</CardTitle>
        <CardDescription>Five-bar gates — countable at a glance.</CardDescription>
      </CardHeader>
      <CardContent>
        <TallyChart rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Walk-ins are running at 23 a week <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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
  { label: "Haircut", value: 412 },
  { label: "Beard", value: 266 },
  { label: "Towel", value: 139 },
  { label: "Colour", value: 184 },
  { label: "Kids", value: 88 },
  { label: "Wash", value: 231 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cleveland Dot Plot</CardTitle>
        <CardDescription>A bar's information, far less ink.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClevelandDotPlot items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Haircuts lead comfortably <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

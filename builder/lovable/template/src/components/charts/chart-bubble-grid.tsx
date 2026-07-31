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

const rows = ["Haircut", "Beard", "Colour", "Towel", "Kids"]
const cols = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const values = [
  [18, 14, 22, 29, 41, 58],
  [12, 9, 15, 19, 26, 34],
  [4, 3, 6, 8, 12, 21],
  [7, 5, 9, 11, 15, 19],
  [3, 2, 4, 5, 8, 17],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bubble Grid</CardTitle>
        <CardDescription>A categorical grid where size is the number.</CardDescription>
      </CardHeader>
      <CardContent>
        <BubbleGrid rows={rows} cols={cols} values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday afternoon is the peak <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

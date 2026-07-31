import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BoxPlot, sampleBoxes } from "./lib/boxplot"

const boxes = sampleBoxes(["Mon", "Tue", "Wed", "Thu", "Fri"], 9)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Box Plot</CardTitle>
        <CardDescription>Spend per visit, by day.</CardDescription>
      </CardHeader>
      <CardContent>
        <BoxPlot boxes={boxes} showOutliers={false} format={(n) => "£" + Math.round(n)} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Friday has the widest spread <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

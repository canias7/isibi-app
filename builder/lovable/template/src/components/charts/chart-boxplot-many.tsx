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

const boxes = sampleBoxes(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"], 23)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Box Plot</CardTitle>
        <CardDescription>Spend per visit, month by month.</CardDescription>
      </CardHeader>
      <CardContent>
        <BoxPlot boxes={boxes} format={(n) => "£" + Math.round(n)} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Spread narrows over the summer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

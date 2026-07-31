import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeatmapMatrix, sampleMatrix } from "./lib/heatmap-matrix"

const rows = ["9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm"]
const cols = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const values = sampleMatrix(rows.length, cols.length, 3)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heatmap</CardTitle>
        <CardDescription>When the shop is busy.</CardDescription>
      </CardHeader>
      <CardContent>
        <HeatmapMatrix rows={rows} cols={cols} values={values} />
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

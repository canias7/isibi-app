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

const rows = ["Cuts", "Colour", "Beard", "Towel"]
const cols = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
const values = sampleMatrix(rows.length, cols.length, 8)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heatmap</CardTitle>
        <CardDescription>Bookings by service, by month.</CardDescription>
      </CardHeader>
      <CardContent>
        <HeatmapMatrix rows={rows} cols={cols} values={values} cell={40} gap={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour is growing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ParallelCoordinates, SERVICE_AXES, SERVICE_ROWS } from "./lib/parallel-coordinates"

const axes = [
  { key: "price", label: "Price", min: 0, max: 80 },
  { key: "minutes", label: "Minutes", min: 0, max: 120 },
  { key: "rating", label: "Rating", min: 0, max: 5 },
  { key: "repeat", label: "Repeat %", min: 0, max: 100 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parallel Coordinates</CardTitle>
        <CardDescription>Axes pinned to a known range.</CardDescription>
      </CardHeader>
      <CardContent>
        <ParallelCoordinates axes={axes} rows={SERVICE_ROWS} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing is rated below 4 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

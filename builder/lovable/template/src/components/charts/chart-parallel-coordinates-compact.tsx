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

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parallel Coordinates</CardTitle>
        <CardDescription>Compact.</CardDescription>
      </CardHeader>
      <CardContent>
        <ParallelCoordinates axes={SERVICE_AXES} rows={SERVICE_ROWS} height={150} showTicks={false} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour costs most and repeats least <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

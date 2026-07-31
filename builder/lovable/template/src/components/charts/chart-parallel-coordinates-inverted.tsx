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
  { key: "price", label: "Price", invert: true },
  { key: "minutes", label: "Minutes", invert: true },
  { key: "rating", label: "Rating" },
  { key: "repeat", label: "Repeat %" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parallel Coordinates</CardTitle>
        <CardDescription>Minutes inverted, so up is always better.</CardDescription>
      </CardHeader>
      <CardContent>
        <ParallelCoordinates axes={axes} rows={SERVICE_ROWS} highlight={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Wash is best on every axis <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

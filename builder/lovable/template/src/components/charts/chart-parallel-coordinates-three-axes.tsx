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
  { key: "price", label: "Price" },
  { key: "rating", label: "Rating" },
  { key: "repeat", label: "Repeat %" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parallel Coordinates</CardTitle>
        <CardDescription>Three measures only.</CardDescription>
      </CardHeader>
      <CardContent>
        <ParallelCoordinates axes={axes} rows={SERVICE_ROWS} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Rating barely varies <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

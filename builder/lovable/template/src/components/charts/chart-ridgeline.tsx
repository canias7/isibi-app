import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Beeswarm, StripPlot, Ridgeline, ECDF, Hexbin, ContourPlot, QQPlot, sample, rng } from "./lib/distributions"

const rows = [
  { label: "Jan", values: sample(80, 30, 8, 3) },
  { label: "Feb", values: sample(80, 33, 9, 5) },
  { label: "Mar", values: sample(80, 38, 11, 7) },
  { label: "Apr", values: sample(80, 41, 10, 9) },
  { label: "May", values: sample(80, 46, 12, 11) },
  { label: "Jun", values: sample(80, 52, 13, 13) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ridgeline</CardTitle>
        <CardDescription>How the shape of spend moves month to month.</CardDescription>
      </CardHeader>
      <CardContent>
        <Ridgeline rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The peak drifts higher <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

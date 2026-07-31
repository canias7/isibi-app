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

const groups = [
  { label: "Cuts", values: sample(60, 24, 5, 3) },
  { label: "Beard", values: sample(60, 15, 4, 7) },
  { label: "Colour", values: sample(60, 62, 16, 11) },
  { label: "Towel", values: sample(60, 19, 5, 13) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strip Plot</CardTitle>
        <CardDescription>Raw observations on one axis each.</CardDescription>
      </CardHeader>
      <CardContent>
        <StripPlot groups={groups} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour spreads widest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

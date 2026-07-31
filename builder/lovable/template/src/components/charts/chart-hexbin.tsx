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

const r = rng(21)
const points = Array.from({ length: 420 }, () => {
  const g = () => (r() + r() + r()) / 3 - 0.5
  return { x: 50 + g() * 60, y: 50 + g() * 60 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hexbin</CardTitle>
        <CardDescription>Where the points actually pile up.</CardDescription>
      </CardHeader>
      <CardContent>
        <Hexbin points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Dense through the middle <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

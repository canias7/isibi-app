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

const values = sample(300, 42, 12, 17)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ECDF</CardTitle>
        <CardDescription>What share of appointments finish under a given time.</CardDescription>
      </CardHeader>
      <CardContent>
        <ECDF values={values} marker={60} format={(n) => n + "m"} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nine in ten finish inside an hour <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

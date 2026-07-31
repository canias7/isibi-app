import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CohortProgression } from "@/components/charts/lib/edu"
const bands = ["Below", "Approaching", "Expected", "Greater depth"]
const years = ["Y3", "Y4", "Y5", "Y6"]
const counts = [
  [24, 38, 46, 12],
  [19, 34, 54, 15],
  [14, 30, 60, 18],
  [10, 26, 62, 24],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bands over four years</CardTitle>
        <CardDescription>Where the cohort moved</CardDescription>
      </CardHeader>
      <CardContent>
        <CohortProgression bands={bands} years={years} counts={counts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Shares, so cohort size does not confuse it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One year group
        </div>
      </CardFooter>
    </Card>
  )
}

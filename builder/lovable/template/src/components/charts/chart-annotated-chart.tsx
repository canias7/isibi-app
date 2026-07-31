import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KpiRow, DashboardGrid, AnnotatedChart, SparklineMatrix, ProgressRingGrid, MetricDistribution, WordTree, KwicList, HeadcountPyramid, MilestoneBurnup } from "./lib/composite"

const values = [42, 45, 44, 61, 58, 49, 47, 46, 44, 38, 41, 52, 66, 71, 68, 64]
const notes = [
  { at: 3, text: "Local paper" },
  { at: 9, text: "Closed for refit", above: false },
  { at: 13, text: "Colour launch" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Annotated Chart</CardTitle>
        <CardDescription>The line, with the reasons written on it.</CardDescription>
      </CardHeader>
      <CardContent>
        <AnnotatedChart values={values} notes={notes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every spike is explained in place <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

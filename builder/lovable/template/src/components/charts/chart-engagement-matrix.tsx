import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NetworkWaterfall, ScrollDepth, ClickGrid, PathTree, AdoptionCurve, AbTestResult, EngagementMatrix, StepFunnel } from "./lib/product"

const rows = ["Daily", "Weekly", "Monthly", "Rarely"]
const cols = ["Browse", "Book", "Manage", "Review"]
const values = [
  [42, 118, 64, 21],
  [96, 174, 88, 34],
  [131, 96, 41, 18],
  [188, 44, 12, 5],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Matrix</CardTitle>
        <CardDescription>Frequency against depth.</CardDescription>
      </CardHeader>
      <CardContent>
        <EngagementMatrix rows={rows} cols={cols} values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A quarter are frequent and deep <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

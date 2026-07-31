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

const grid = [
  [2, 14, 38, 12, 3],
  [1, 6, 9, 5, 1],
  [4, 22, 31, 18, 2],
  [1, 3, 7, 4, 1],
  [0, 9, 26, 11, 1],
  [0, 1, 3, 2, 0],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Click Grid</CardTitle>
        <CardDescription>Where clicks land on the page.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ClickGrid grid={grid} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The header takes most of them <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

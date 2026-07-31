import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LatencyPercentiles } from "@/components/charts/lib/mldata"
const points = [
  { p: 0.5, ms: 42 }, { p: 0.75, ms: 68 }, { p: 0.9, ms: 118 },
  { p: 0.95, ms: 190 }, { p: 0.99, ms: 640 }, { p: 0.999, ms: 2400 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Response time by percentile</CardTitle>
        <CardDescription>The tail is the story</CardDescription>
      </CardHeader>
      <CardContent>
        <LatencyPercentiles points={points} budgetMs={500} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nobody should be paged on the mean <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last 24 hours
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwotGrid, OkrTree, MetroMap, SeatingChart, ResourceHistogram } from "./lib/org2"

const periods = ["W1", "W2", "W3", "W4", "W5", "W6"]
const people = ["Ada", "Mo", "Sam"]
const hours = [
  [30, 24, 18], [34, 28, 22], [38, 36, 30], [30, 26, 20], [26, 22, 18], [22, 18, 14],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Histogram</CardTitle>
        <CardDescription>Stacked workload against the capacity line.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResourceHistogram periods={periods} people={people} hours={hours} capacity={90} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Week three does not fit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AndrewsCurves, Radviz, ParallelSets, ClusterScatter, Caterpillar, Cusum } from "./lib/multivariate"

const units = Array.from({ length: 26 }, (_, i) => {
  const est = -1.3 + (i / 25) * 2.6 + Math.sin(i * 3.7) * 0.12
  const w = 0.55 + ((i * 13) % 7) * 0.07
  return { label: "Branch " + (i + 1), estimate: est, low: est - w, high: est + w }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caterpillar Plot</CardTitle>
        <CardDescription>Every branch ranked, with its interval.</CardDescription>
      </CardHeader>
      <CardContent>
        <Caterpillar units={units} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Only the ends differ from the average <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

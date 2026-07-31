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

const rows = Array.from({ length: 34 }, (_, i) => {
  const g = i % 3 === 0 ? 1 : 0
  const base = g ? [3, 1.5, -0.8, 0.9] : [1, -0.6, 0.7, -0.4]
  return { group: g, values: base.map((b, d) => b + Math.sin(i * 2.7 + d) * 0.5) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Andrews Curves</CardTitle>
        <CardDescription>Each record as a Fourier curve.</CardDescription>
      </CardHeader>
      <CardContent>
        <AndrewsCurves rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One group traces a distinct band <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

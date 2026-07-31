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

const mk = (cx: number, cy: number, n: number, seed: number, name: string) =>
  Array.from({ length: n }, (_, i) => ({
    x: cx + Math.sin(seed * 9 + i * 2.7) * 1.4,
    y: cy + Math.cos(seed * 7 + i * 1.9) * 1.2,
    cluster: name,
  }))
const points = [
  ...mk(2, 8, 16, 1, "Regulars"),
  ...mk(7, 6.4, 14, 2, "New"),
  ...mk(4.6, 2, 12, 3, "Lapsed"),
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cluster Scatter</CardTitle>
        <CardDescription>An embedding with the clusters hulled.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ClusterScatter points={points} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three groups, one straggler <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

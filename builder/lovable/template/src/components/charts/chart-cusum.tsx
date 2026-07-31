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

const values = [
  40, 41, 39, 42, 40, 38, 41, 40, 42, 39,
  43, 44, 43, 45, 44, 46, 45, 44, 46, 47,
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CUSUM</CardTitle>
        <CardDescription>Small persistent shifts, accumulated until visible.</CardDescription>
      </CardHeader>
      <CardContent>
        <Cusum values={values} target={40} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A sustained shift, not one bad day <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

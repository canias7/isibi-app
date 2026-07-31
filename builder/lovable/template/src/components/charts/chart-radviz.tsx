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

const anchors = ["Price", "Speed", "Rating", "Repeat"]
const rows = Array.from({ length: 40 }, (_, i) => {
  const heavy = i % 4 === 0
  return { values: heavy ? [9 + (i % 3), 2, 3, 2] : [2 + (i % 3), 4 + ((i * 7) % 4), 3 + ((i * 5) % 3), 4 + (i % 4)] }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RadViz</CardTitle>
        <CardDescription>Records pulled between dimensional anchors.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Radviz anchors={anchors} rows={rows} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A cluster sits hard against Price <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

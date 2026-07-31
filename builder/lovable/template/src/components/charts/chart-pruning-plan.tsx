import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PruningPlan } from "@/components/charts/lib/horticulture"
const trees = [
  { name: "Lime, front lawn", canopyM3: 480, removeM3: 96, note: "Crown lift to 4 m" },
  { name: "Oak, boundary", canopyM3: 1240, removeM3: 180, note: "Deadwood only" },
  { name: "Sycamore, car park", canopyM3: 620, removeM3: 210, note: "Reduction, 2 m" },
  { name: "Birch, courtyard", canopyM3: 210, removeM3: 38 },
  { name: "Horse chestnut", canopyM3: 890, removeM3: 285, note: "Reduction, 3 m" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pruning plan</CardTitle>
        <CardDescription>Removal as a fraction of each tree's own canopy</CardDescription>
      </CardHeader>
      <CardContent>
        <PruningPlan trees={trees} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Over a quarter and it fights back <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Winter works
        </div>
      </CardFooter>
    </Card>
  )
}

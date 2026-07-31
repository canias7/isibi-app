import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OneRepMax } from "@/components/charts/lib/fitness"
const sets = [
  { date: "Wk 1", weight: 100, reps: 5 }, { date: "Wk 1", weight: 110, reps: 3 }, { date: "Wk 1", weight: 92, reps: 8 },
  { date: "Wk 3", weight: 105, reps: 5 }, { date: "Wk 3", weight: 118, reps: 3 }, { date: "Wk 3", weight: 96, reps: 8 },
  { date: "Wk 5", weight: 110, reps: 5 }, { date: "Wk 5", weight: 124, reps: 2 }, { date: "Wk 5", weight: 100, reps: 8 },
  { date: "Wk 7", weight: 114, reps: 5 }, { date: "Wk 7", weight: 132, reps: 2 }, { date: "Wk 7", weight: 104, reps: 7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimated one-rep max</CardTitle>
        <CardDescription>Every set placed on the load–rep curve</CardDescription>
      </CardHeader>
      <CardContent>
        <OneRepMax sets={sets} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The estimate moved 14 kg in a block <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Back squat
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MasteryGrid } from "@/components/charts/lib/edu"
const learners = ["Adeyemi", "Brandt", "Costa", "Dlamini", "Erikson", "Farouk", "Gupta"]
const objectives = ["Place value", "Rounding", "Column addition", "Long division", "Fractions", "Ratio", "Percentages", "Word problems"]
const levels = [
  [3, 3, 3, 1, 3, 2, 2, 1], [3, 3, 2, 0, 2, 2, 1, 1], [3, 3, 3, 1, 3, 3, 3, 2],
  [2, 2, 2, 0, 2, 1, 1, 0], [3, 3, 3, 2, 3, 3, 2, 2], [3, 2, 3, 1, 2, 2, 2, 1],
  [3, 3, 3, 0, 3, 2, 3, 2],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Objectives met</CardTitle>
        <CardDescription>Where the class as a whole is stuck</CardDescription>
      </CardHeader>
      <CardContent>
        <MasteryGrid learners={learners} objectives={objectives} levels={levels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A weak column is a reteach, not intervention <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Unit 4
        </div>
      </CardFooter>
    </Card>
  )
}

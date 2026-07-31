import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VarroaLoad } from "@/components/charts/lib/apiary"
const colonies = ["Hive 1", "Hive 2", "Hive 3", "Hive 4", "Hive 5", "Hive 6"]
const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
const counts = [
  [0.4, 0.8, 1.6, 2.9, 4.8, 2.1],
  [0.2, 0.5, 0.9, 1.4, 2.2, 1.1],
  [1.1, 2.4, 3.8, 6.2, 8.9, 5.4],
  [0.3, 0.6, 1.1, 1.9, 3.4, 1.6],
  [0.8, 1.9, 3.1, 4.2, 6.1, 3.2],
  [0.1, 0.3, 0.6, 1.0, 1.8, 0.9],
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mite counts</CardTitle>
        <CardDescription>Alcohol wash, per hundred bees</CardDescription>
      </CardHeader>
      <CardContent>
        <VarroaLoad colonies={colonies} months={months} counts={counts} threshold={3} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The threshold is the decision, not the count <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six colonies
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CarbonBudget } from "@/components/charts/lib/climate"
const scenarios = [
  { name: "Halve by 2035", annualGt: 24 },
  { name: "Pledges as stated", annualGt: 34 },
  { name: "No new policy", annualGt: 48 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How long the budget lasts</CardTitle>
        <CardDescription>Gigatonnes turned into years</CardDescription>
      </CardHeader>
      <CardContent>
        <CarbonBudget budgetGt={250} annualGt={41} scenarios={scenarios} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A tonnage hides the date <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1.5°C, 50% chance
        </div>
      </CardFooter>
    </Card>
  )
}

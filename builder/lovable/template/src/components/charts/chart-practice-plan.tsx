import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PracticePlan } from "@/components/charts/lib/vet"
const cohorts = [
  { name: "Dogs, on plan", animals: 412, onPlan: true, visitsPerYear: 3.4, feeSpendPerYear: 218 },
  { name: "Dogs, pay as you go", animals: 386, onPlan: false, visitsPerYear: 1.6, feeSpendPerYear: 174 },
  { name: "Cats, on plan", animals: 248, onPlan: true, visitsPerYear: 2.7, feeSpendPerYear: 161 },
  { name: "Cats, pay as you go", animals: 431, onPlan: false, visitsPerYear: 1.1, feeSpendPerYear: 132 },
  { name: "Small furries", animals: 94, onPlan: false, visitsPerYear: 0.8, feeSpendPerYear: 61 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice plan</CardTitle>
        <CardDescription>Net of what it gives away</CardDescription>
      </CardHeader>
      <CardContent>
        <PracticePlan cohorts={cohorts} planFeePerMonth={21} planIncludedValue={186} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The mechanism is visits, not price <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Per animal, per year
        </div>
      </CardFooter>
    </Card>
  )
}

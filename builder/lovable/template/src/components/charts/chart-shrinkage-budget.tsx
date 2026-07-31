import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShrinkageBudget } from "@/components/charts/lib/contact"
const categories = [
  { name: "Annual leave", hours: 1240, plannable: true },
  { name: "Breaks", hours: 1420, plannable: true },
  { name: "Training", hours: 620, plannable: true },
  { name: "Coaching", hours: 340, plannable: true },
  { name: "Sickness", hours: 780, plannable: false },
  { name: "System downtime", hours: 190, plannable: false },
  { name: "Unplanned off-phone", hours: 410, plannable: false },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shrinkage</CardTitle>
        <CardDescription>Paid hours against hours on the phone</CardDescription>
      </CardHeader>
      <CardContent>
        <ShrinkageBudget categories={categories} paidHours={16000} requiredOnPhone={9600} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Divide by one minus shrinkage, never subtract the percentage <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}

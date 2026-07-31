import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PayrunVariance } from "@/components/charts/lib/payroll"
const movements = [
  { name: "Starters", amount: 41200, headcount: 9 },
  { name: "Leavers", amount: -28400, headcount: 6 },
  { name: "Annual review", amount: 62800, headcount: 214 },
  { name: "Overtime", amount: -9100 },
  { name: "Bonus accrual", amount: 18400 },
  { name: "Statutory sick pay", amount: 2100, headcount: 11 },
  { name: "Maternity", amount: -6800, headcount: 3 },
  { name: "Salary sacrifice uptake", amount: -3400, headcount: 18 },
  { name: "Correction, prior period", amount: 1240, headcount: 2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payrun variance</CardTitle>
        <CardDescription>Every movement attributed</CardDescription>
      </CardHeader>
      <CardContent>
        <PayrunVariance previousTotal={1840000} movements={movements} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One reason is normal, nine is a control question <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Against last month
        </div>
      </CardFooter>
    </Card>
  )
}

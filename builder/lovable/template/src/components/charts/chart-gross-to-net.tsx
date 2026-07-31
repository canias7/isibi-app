import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GrossToNet } from "@/components/charts/lib/payroll"
const levels = [
  { gross: 24000, incomeTax: 2286, nationalInsurance: 913, pension: 1200 },
  { gross: 36000, incomeTax: 4686, nationalInsurance: 1873, pension: 1800, studentLoan: 720 },
  { gross: 48000, incomeTax: 7086, nationalInsurance: 2833, pension: 2400, studentLoan: 1800 },
  { gross: 62000, incomeTax: 12432, nationalInsurance: 3313, pension: 3100, studentLoan: 3060 },
  { gross: 105000, incomeTax: 30432, nationalInsurance: 4173, pension: 5250, studentLoan: 6930 },
  { gross: 125000, incomeTax: 42432, nationalInsurance: 4573, pension: 6250, studentLoan: 8730 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gross to net</CardTitle>
        <CardDescription>Everything between a salary and a bank transfer</CardDescription>
      </CardHeader>
      <CardContent>
        <GrossToNet levels={levels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The marginal rate is nowhere on a payslip <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six salary points
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PensionOptOut } from "@/components/charts/lib/payroll"
const bands = [
  { name: "Under 25", headcount: 84, optedOut: 31, meanSalary: 24800, meanAge: 22 },
  { name: "25–34", headcount: 162, optedOut: 24, meanSalary: 36400, meanAge: 29 },
  { name: "35–44", headcount: 148, optedOut: 11, meanSalary: 48200, meanAge: 39 },
  { name: "45–54", headcount: 96, optedOut: 6, meanSalary: 54100, meanAge: 49 },
  { name: "55 and over", headcount: 52, optedOut: 9, meanSalary: 51600, meanAge: 59 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pension opt-outs</CardTitle>
        <CardDescription>Priced over a career, decided on a payslip</CardDescription>
      </CardHeader>
      <CardContent>
        <PensionOptOut
          bands={bands}
          employerRate={0.08}
          yearsToRetirement={(age) => 67 - age}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Employer money nobody is taking <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By band
        </div>
      </CardFooter>
    </Card>
  )
}

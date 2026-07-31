import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CostToEmploy } from "@/components/charts/lib/payroll"
const roles = [
  { name: "Software engineer", salary: 68000, employerNi: 8280, pension: 5440, benefits: 2400, equipment: 1400, space: 3200, training: 1800 },
  { name: "Support agent", salary: 26000, employerNi: 2480, pension: 2080, benefits: 900, equipment: 700, space: 3200, training: 600 },
  { name: "Field engineer", salary: 38000, employerNi: 4136, pension: 3040, benefits: 1200, equipment: 6800, space: 400, training: 2400 },
  { name: "Designer", salary: 52000, employerNi: 6072, pension: 4160, benefits: 1800, equipment: 2600, space: 3200, training: 1200 },
  { name: "Warehouse operative", salary: 24000, employerNi: 2204, pension: 1920, benefits: 600, equipment: 900, space: 1100, training: 400 },
  { name: "Sales executive", salary: 44000, employerNi: 4964, pension: 3520, benefits: 3800, equipment: 1200, space: 1600, training: 1400 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost to employ</CardTitle>
        <CardDescription>The multiple over salary is not a constant</CardDescription>
      </CardHeader>
      <CardContent>
        <CostToEmploy roles={roles} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A headcount budget in salaries under-provides for some roles <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six roles
        </div>
      </CardFooter>
    </Card>
  )
}

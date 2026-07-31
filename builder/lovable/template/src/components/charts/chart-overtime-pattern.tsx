import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OvertimePattern } from "@/components/charts/lib/payroll"
const people = ["A. Nowak", "B. Osei", "C. Patel", "D. Quinn", "E. Ríos", "F. Silva", "G. Tan"]
const weeks = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8"]
const hours = [
  [8, 12, 10, 14, 9, 11, 13, 10],
  [0, 4, 0, 0, 6, 0, 0, 0],
  [14, 16, 12, 18, 15, 14, 16, 13],
  [0, 0, 8, 0, 0, 0, 0, 0],
  [6, 0, 4, 8, 0, 6, 0, 4],
  [0, 0, 0, 12, 0, 0, 0, 0],
  [10, 9, 11, 8, 12, 10, 9, 11],
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overtime</CardTitle>
        <CardDescription>A pattern, not a monthly total</CardDescription>
      </CardHeader>
      <CardContent>
        <OvertimePattern people={people} weeks={weeks} hours={hours} contractedHours={37.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Full-time equivalents bought at overtime rates <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight weeks
        </div>
      </CardFooter>
    </Card>
  )
}

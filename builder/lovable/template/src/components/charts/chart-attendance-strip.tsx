import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AttendanceStrip } from "@/components/charts/lib/edu"
type M = "present" | "late" | "absent" | "authorised"
const days = Array.from({ length: 30 }, (_, i) => `d${i + 1}`)
let s = 21
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const learners = ["Adeyemi", "Brandt", "Costa", "Dlamini", "Erikson", "Farouk"].map((name, li) => ({
  name,
  marks: days.map((_, d): M => {
    if (li === 3 && d >= 9 && d <= 17) return "absent"
    if (li === 1 && d % 5 === 4) return "absent"
    const x = r()
    return x > 0.93 ? "authorised" : x > 0.87 ? "late" : "present"
  }),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>Day by day</CardDescription>
      </CardHeader>
      <CardContent>
        <AttendanceStrip learners={learners} days={days} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The longest run matters as much as the rate <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Half term
        </div>
      </CardFooter>
    </Card>
  )
}

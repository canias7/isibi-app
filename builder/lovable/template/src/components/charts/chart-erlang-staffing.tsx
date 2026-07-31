import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ErlangStaffing } from "@/components/charts/lib/contact"
// the roster is a real one: right most of the day, two short at the peak and
// two over at lunch, which is what a rostered day actually looks like
const intervals = [
  { label: "08:00", calls: 42, scheduled: 11 }, { label: "08:30", calls: 68, scheduled: 16 },
  { label: "09:00", calls: 124, scheduled: 26 }, { label: "09:30", calls: 168, scheduled: 32 },
  { label: "10:00", calls: 186, scheduled: 35 }, { label: "10:30", calls: 174, scheduled: 36 },
  { label: "11:00", calls: 152, scheduled: 32 }, { label: "11:30", calls: 138, scheduled: 29 },
  { label: "12:00", calls: 121, scheduled: 28 }, { label: "12:30", calls: 114, scheduled: 27 },
  { label: "13:00", calls: 132, scheduled: 28 }, { label: "13:30", calls: 148, scheduled: 31 },
  { label: "14:00", calls: 156, scheduled: 30 }, { label: "14:30", calls: 141, scheduled: 29 },
  { label: "15:00", calls: 118, scheduled: 25 }, { label: "15:30", calls: 86, scheduled: 19 },
  { label: "16:00", calls: 58, scheduled: 14 }, { label: "16:30", calls: 34, scheduled: 9 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staffing</CardTitle>
        <CardDescription>Agents required, half hour by half hour</CardDescription>
      </CardHeader>
      <CardContent>
        <ErlangStaffing intervals={intervals} ahtSeconds={310} targetSeconds={20} targetServiceLevel={0.8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Requirement is not proportional to volume <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          80% in 20 seconds
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VisitFrequency } from "@/components/charts/lib/gym"
const bands = [
  { label: "Never came", members: 386, meanVisits: 0, churnRate: 0.11 },
  { label: "Under once a month", members: 412, meanVisits: 0.6, churnRate: 0.08 },
  { label: "One to three", members: 468, meanVisits: 2.1, churnRate: 0.05 },
  { label: "Four to eight", members: 394, meanVisits: 5.8, churnRate: 0.03 },
  { label: "Nine to fifteen", members: 291, meanVisits: 11.4, churnRate: 0.02 },
  { label: "Sixteen or more", members: 189, meanVisits: 19.6, churnRate: 0.015 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visits a month</CardTitle>
        <CardDescription>Paid by the month, costed by the visit</CardDescription>
      </CardHeader>
      <CardContent>
        <VisitFrequency bands={bands} monthlyFee={34} costPerVisit={2.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The profit and the churn risk are the same people <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          2,140 members
        </div>
      </CardFooter>
    </Card>
  )
}

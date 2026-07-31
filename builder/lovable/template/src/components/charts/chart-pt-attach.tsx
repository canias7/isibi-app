import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PtAttach } from "@/components/charts/lib/gym"
const segments = [
  { name: "New joiners, first 90 days", members: 486, withPt: 62, sessionsPerMonth: 3.1, churnWithPt: 0.04, churnWithout: 0.16 },
  { name: "Regulars, over a year", members: 641, withPt: 148, sessionsPerMonth: 2.4, churnWithPt: 0.015, churnWithout: 0.03 },
  { name: "Returning after a lapse", members: 214, withPt: 31, sessionsPerMonth: 2.8, churnWithPt: 0.05, churnWithout: 0.14 },
  { name: "Rehab and referral", members: 96, withPt: 54, sessionsPerMonth: 4.2, churnWithPt: 0.02, churnWithout: 0.09 },
  { name: "Off-peak concession", members: 372, withPt: 18, sessionsPerMonth: 1.9, churnWithPt: 0.04, churnWithout: 0.07 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal training</CardTitle>
        <CardDescription>Margin across the whole segment</CardDescription>
      </CardHeader>
      <CardContent>
        <PtAttach segments={segments} sessionPrice={42} trainerCostShare={0.6} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Sold to whoever asks, not whoever it holds <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By segment
        </div>
      </CardFooter>
    </Card>
  )
}

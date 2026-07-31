import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StaffingCurve } from "@/components/charts/lib/events"
const demand = [40, 120, 310, 480, 620, 410, 180, 90, 140, 520, 700, 380, 120, 60]
const rostered = [4, 6, 8, 10, 10, 10, 10, 10, 10, 10, 10, 8, 6, 4]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staffing</CardTitle>
        <CardDescription>What the demand curve actually needs</CardDescription>
      </CardHeader>
      <CardContent>
        <StaffingCurve demand={demand} servedPerStaffPerHour={90} rostered={rostered} minutesPerSample={30} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The headcount can be right and the shape wrong <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bar service
        </div>
      </CardFooter>
    </Card>
  )
}

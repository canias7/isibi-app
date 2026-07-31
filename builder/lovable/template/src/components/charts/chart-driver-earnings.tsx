import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DriverEarnings } from "@/components/charts/lib/taxi"
const weeks = [
  { label: "Week 1", gross: 940, commission: 235, fuel: 148, vehicle: 165, licensing: 24 },
  { label: "Week 2", gross: 1120, commission: 280, fuel: 186, vehicle: 165, licensing: 24 },
  { label: "Week 3", gross: 780, commission: 195, fuel: 121, vehicle: 165, licensing: 24 },
  { label: "Week 4", gross: 1240, commission: 310, fuel: 214, vehicle: 165, licensing: 24 },
  { label: "Week 5", gross: 860, commission: 215, fuel: 139, vehicle: 165, licensing: 24 },
  { label: "Week 6", gross: 1010, commission: 252, fuel: 168, vehicle: 165, licensing: 24 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What a driver clears</CardTitle>
        <CardDescription>Everything else is quoted gross</CardDescription>
      </CardHeader>
      <CardContent>
        <DriverEarnings weeks={weeks} hoursPerWeek={48} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A big gross week and a good week are not the same <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six weeks
        </div>
      </CardFooter>
    </Card>
  )
}

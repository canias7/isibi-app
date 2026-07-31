import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ComebackRate } from "@/components/charts/lib/garage"
const categories = [
  { name: "Diagnostics", jobs: 96, comebacks: 14, meanReworkHours: 2.4 },
  { name: "Clutch and gearbox", jobs: 41, comebacks: 4, meanReworkHours: 5.1 },
  { name: "Brakes", jobs: 214, comebacks: 9, meanReworkHours: 1.2 },
  { name: "Servicing", jobs: 486, comebacks: 11, meanReworkHours: 0.7 },
  { name: "Electrical", jobs: 118, comebacks: 21, meanReworkHours: 1.9 },
  { name: "Tyres", jobs: 392, comebacks: 6, meanReworkHours: 0.4 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comebacks</CardTitle>
        <CardDescription>The bay hour is lost twice</CardDescription>
      </CardHeader>
      <CardContent>
        <ComebackRate categories={categories} windowDays={28} labourRate={62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A warranty job is not a job worth nothing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          28-day window
        </div>
      </CardFooter>
    </Card>
  )
}

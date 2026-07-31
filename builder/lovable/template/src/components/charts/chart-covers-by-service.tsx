import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CoversByService } from "@/components/charts/lib/restaurant"
const slots = [
  { time: "17:30", covers: 12 }, { time: "18:00", covers: 26 },
  { time: "18:30", covers: 38 }, { time: "19:00", covers: 54 },
  { time: "19:30", covers: 61 }, { time: "20:00", covers: 78 },
  { time: "20:30", covers: 66 }, { time: "21:00", covers: 41 },
  { time: "21:30", covers: 22 }, { time: "22:00", covers: 9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Covers by service</CardTitle>
        <CardDescription>Seatings against what the kitchen can plate</CardDescription>
      </CardHeader>
      <CardContent>
        <CoversByService slots={slots} kitchenCapacity={68} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The 20:00 slot is over the pass <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Saturday dinner
        </div>
      </CardFooter>
    </Card>
  )
}

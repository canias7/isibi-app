import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ZoneWait } from "@/components/charts/lib/taxi"
const hours = ["06", "08", "10", "12", "14", "16", "18", "20", "22", "00", "02", "04"]
const zones = [
  { name: "City centre", riderWaitMin: [3, 6, 4, 5, 4, 9, 12, 8, 14, 18, 11, 4], driverWaitMin: [9, 4, 7, 6, 7, 3, 1, 2, 1, 1, 2, 8] },
  { name: "Station", riderWaitMin: [7, 11, 5, 6, 5, 8, 13, 6, 7, 5, 3, 2], driverWaitMin: [4, 2, 6, 6, 7, 4, 2, 5, 6, 8, 12, 16] },
  { name: "Airport", riderWaitMin: [4, 5, 3, 3, 4, 6, 5, 4, 3, 2, 2, 6], driverWaitMin: [14, 18, 22, 19, 16, 12, 11, 14, 18, 24, 26, 19] },
  { name: "North suburbs", riderWaitMin: [9, 14, 8, 7, 8, 12, 16, 9, 8, 6, 4, 5], driverWaitMin: [3, 2, 5, 6, 5, 3, 2, 4, 5, 6, 9, 11] },
  { name: "Hospital", riderWaitMin: [6, 8, 7, 9, 11, 14, 9, 6, 5, 4, 4, 5], driverWaitMin: [6, 5, 6, 5, 4, 3, 4, 6, 7, 8, 9, 8] },
  { name: "Retail park", riderWaitMin: [2, 4, 6, 8, 9, 11, 7, 3, 2, 1, 1, 1], driverWaitMin: [12, 9, 6, 5, 4, 3, 5, 9, 14, 18, 21, 22] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is waiting</CardTitle>
        <CardDescription>One signed number a cell</CardDescription>
      </CardHeader>
      <CardContent>
        <ZoneWait zones={zones} hours={hours} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Moving a car beats adding one <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Friday
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FloorLoad } from "@/components/charts/lib/gym"
const hours = ["06", "07", "08", "09", "11", "13", "15", "17", "18", "19", "20", "21"]
const areas = [
  { name: "Squat racks", stations: 4, usersPerHour: [3, 4, 2, 1, 1, 2, 3, 7, 9, 8, 5, 2] },
  { name: "Free weights", stations: 12, usersPerHour: [6, 9, 5, 3, 2, 4, 6, 14, 17, 15, 9, 4] },
  { name: "Treadmills", stations: 14, usersPerHour: [9, 11, 6, 4, 3, 5, 7, 12, 15, 13, 8, 3] },
  { name: "Resistance machines", stations: 18, usersPerHour: [5, 7, 4, 3, 3, 4, 6, 13, 16, 14, 9, 4] },
  { name: "Functional area", stations: 6, usersPerHour: [2, 3, 2, 1, 1, 2, 3, 8, 11, 9, 5, 2] },
  { name: "Rowers", stations: 6, usersPerHour: [3, 4, 2, 1, 1, 2, 2, 5, 7, 6, 4, 1] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The floor</CardTitle>
        <CardDescription>People per station, hour by hour</CardDescription>
      </CardHeader>
      <CardContent>
        <FloorLoad areas={areas} hours={hours} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A queue is what a member actually experiences <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Weekday
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OccupancyBand } from "@/components/charts/lib/contact"
const intervals = [
  { label: "08:00", handledSeconds: 9800, loggedSeconds: 17400 },
  { label: "08:30", handledSeconds: 14200, loggedSeconds: 21600 },
  { label: "09:00", handledSeconds: 27400, loggedSeconds: 32400 },
  { label: "09:30", handledSeconds: 38100, loggedSeconds: 41400 },
  { label: "10:00", handledSeconds: 43600, loggedSeconds: 45900 },
  { label: "10:30", handledSeconds: 42100, loggedSeconds: 45900 },
  { label: "11:00", handledSeconds: 35800, loggedSeconds: 41400 },
  { label: "11:30", handledSeconds: 31200, loggedSeconds: 37800 },
  { label: "12:00", handledSeconds: 22400, loggedSeconds: 28800 },
  { label: "12:30", handledSeconds: 20100, loggedSeconds: 27000 },
  { label: "13:00", handledSeconds: 28900, loggedSeconds: 34200 },
  { label: "13:30", handledSeconds: 34600, loggedSeconds: 39600 },
  { label: "14:00", handledSeconds: 37800, loggedSeconds: 41400 },
  { label: "14:30", handledSeconds: 32900, loggedSeconds: 39600 },
  { label: "15:00", handledSeconds: 25400, loggedSeconds: 34200 },
  { label: "15:30", handledSeconds: 16800, loggedSeconds: 27000 },
  { label: "16:00", handledSeconds: 10200, loggedSeconds: 19800 },
  { label: "16:30", handledSeconds: 5400, loggedSeconds: 14400 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy</CardTitle>
        <CardDescription>Both sides of the band cost money</CardDescription>
      </CardHeader>
      <CardContent>
        <OccupancyBand intervals={intervals} sustainable={[0.75, 0.88]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The mean sits inside a band it rarely describes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One day, half hours
        </div>
      </CardFooter>
    </Card>
  )
}

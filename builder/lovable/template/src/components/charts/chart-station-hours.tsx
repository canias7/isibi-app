import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StationHours } from "@/components/charts/lib/salon"
const chairs = [
  { name: "Chair 1 · Amara", bookedHours: 41, takings: 1420 },
  { name: "Chair 2 · Joss", bookedHours: 34, takings: 1180 },
  { name: "Chair 3 · Nadia", bookedHours: 28, takings: 890 },
  { name: "Chair 4 · Ellis", bookedHours: 19, takings: 640 },
  { name: "Chair 5 · Rae", bookedHours: 44, takings: 1610, rentPerWeek: 280 },
  { name: "Chair 6 · Devi", bookedHours: 38, takings: 1240, rentPerWeek: 240 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chairs</CardTitle>
        <CardDescription>Rented and employed, side by side</CardDescription>
      </CardHeader>
      <CardContent>
        <StationHours chairs={chairs} openHoursPerWeek={48} employedCostPerHour={16} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two businesses sharing a room <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week
        </div>
      </CardFooter>
    </Card>
  )
}

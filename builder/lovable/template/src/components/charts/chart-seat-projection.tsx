import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SeatProjection } from "@/components/charts/lib/elections"
const parties = [
  { name: "Blue", seats: 268, low: 244, high: 291 },
  { name: "Red", seats: 241, low: 219, high: 264 },
  { name: "Green", seats: 62, low: 48, high: 79 },
  { name: "Amber", seats: 39, low: 28, high: 51 },
  { name: "Regional", seats: 29, low: 24, high: 34 },
  { name: "Others", seats: 9, low: 5, high: 14 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seat projection</CardTitle>
        <CardDescription>The chamber with the majority line derived</CardDescription>
      </CardHeader>
      <CardContent>
        <SeatProjection parties={parties} totalSeats={648} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nobody can govern alone <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          325 for a majority
        </div>
      </CardFooter>
    </Card>
  )
}

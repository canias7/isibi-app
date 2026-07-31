import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HandoverDelay } from "@/components/charts/lib/emergency"
const hospitals = [
  { name: "City General", arrivals: 3120, meanHandoverMin: 48, over60: 640 },
  { name: "St Mary's", arrivals: 1840, meanHandoverMin: 72, over60: 610 },
  { name: "Riverside", arrivals: 2260, meanHandoverMin: 26, over60: 120 },
  { name: "Northgate", arrivals: 980, meanHandoverMin: 94, over60: 402 },
  { name: "Community unit", arrivals: 640, meanHandoverMin: 18, over60: 12 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Handover</CardTitle>
        <CardDescription>Recorded per patient, spent as fleet capacity</CardDescription>
      </CardHeader>
      <CardContent>
        <HandoverDelay hospitals={hospitals} targetMin={15} crewCostPerHour={94} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Crews off the road for a shift <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}

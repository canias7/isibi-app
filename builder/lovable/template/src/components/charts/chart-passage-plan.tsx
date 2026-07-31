import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PassagePlan } from "@/components/charts/lib/sailing"
const legs = [
  { name: "Harbour to the fairway", distanceNm: 2.4, streamKn: 0.4 },
  { name: "Fairway to the headland", distanceNm: 9.6, streamKn: 1.8 },
  { name: "Round the headland", distanceNm: 4.2, streamKn: -2.4 },
  { name: "Across the bay", distanceNm: 14.8, streamKn: -0.9 },
  { name: "Bay to the entrance", distanceNm: 7.1, streamKn: 1.2 },
  { name: "Entrance to the berth", distanceNm: 1.8, streamKn: 0.3 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Passage plan</CardTitle>
        <CardDescription>ETA from speed over the ground</CardDescription>
      </CardHeader>
      <CardContent>
        <PassagePlan legs={legs} boatSpeedKn={5.6} startHour={6} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A foul stream costs more than a fair one saves <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Departing 06:00
        </div>
      </CardFooter>
    </Card>
  )
}

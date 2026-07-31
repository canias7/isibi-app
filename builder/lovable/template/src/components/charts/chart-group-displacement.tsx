import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GroupDisplacement } from "@/components/charts/lib/hotel"
const nights = [
  { label: "Thu 14", capacity: 214, forecastRooms: 128, forecastAdr: 156 },
  { label: "Fri 15", capacity: 214, forecastRooms: 182, forecastAdr: 208 },
  { label: "Sat 16", capacity: 214, forecastRooms: 201, forecastAdr: 236 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Group displacement</CardTitle>
        <CardDescription>What a group earns against what it turns away</CardDescription>
      </CardHeader>
      <CardContent>
        <GroupDisplacement nights={nights} groupRooms={60} groupRate={139} ancillaryPerRoom={42} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One night loses money whatever the rate <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three-night block
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SurgeCapacity } from "@/components/charts/lib/emergency"
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const base = [8, 6, 5, 5, 5, 7, 11, 15, 18, 19, 20, 19, 19, 18, 19, 20, 21, 22, 21, 18, 16, 14, 12, 10]
const arrivals = base.map((v, i) => (i >= 16 && i <= 20 ? Math.round(v * 2.4) : v))
const surgeCrews = hours.map((_, i) => (i >= 17 && i <= 23 ? 10 : 0))
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Surge</CardTitle>
        <CardDescription>The queue that forms, carried hour to hour</CardDescription>
      </CardHeader>
      <CardContent>
        <SurgeCapacity
          hours={hours}
          arrivals={arrivals}
          baseCrews={26}
          surgeCrews={surgeCrews}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Judged on how long the backlog persists <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One incident day
        </div>
      </CardFooter>
    </Card>
  )
}

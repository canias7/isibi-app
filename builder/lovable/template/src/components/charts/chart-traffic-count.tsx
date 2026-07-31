import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrafficCount } from "@/components/charts/lib/civil"
const hours = ["07","08","09","10","11","12","13","14","15","16","17","18"]
const classes = ["Car", "LGV", "HGV", "Bus", "Cycle"]
const counts = hours.map((_, i) => {
  const peak = i === 1 || i === 2 ? 1.9 : i === 9 || i === 10 ? 1.75 : 1
  return [
    Math.round(420 * peak),
    Math.round(96 * (peak * 0.7 + 0.3)),
    Math.round(74 * (i < 4 ? 1.6 : 0.9)),
    Math.round(18 * peak),
    Math.round(34 * peak),
  ]
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classified count</CardTitle>
        <CardDescription>Vehicles by class through the day</CardDescription>
      </CardHeader>
      <CardContent>
        <TrafficCount hours={hours} classes={classes} counts={counts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Heavy vehicles are 5% of the flow <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve-hour count
        </div>
      </CardFooter>
    </Card>
  )
}

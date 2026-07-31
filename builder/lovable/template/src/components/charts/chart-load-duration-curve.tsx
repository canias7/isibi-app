import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoadDurationCurve } from "@/components/charts/lib/power"
const hourlyLoad = Array.from({ length: 8760 }, (_, h) => {
  const day = Math.sin(((h % 24) / 24) * Math.PI * 2 - 1.9)
  const year = Math.cos((h / 8760) * Math.PI * 2)
  const wobble = Math.sin(h * 1.7) * 0.5
  return Math.round(28000 + day * 5200 + year * 6400 + wobble * 900)
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demand, sorted</CardTitle>
        <CardDescription>Every hour of the year by size</CardDescription>
      </CardHeader>
      <CardContent>
        <LoadDurationCurve hourlyLoad={hourlyLoad} baseloadCapacity={26000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The peak exists for a handful of hours <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          8,760 hours
        </div>
      </CardFooter>
    </Card>
  )
}

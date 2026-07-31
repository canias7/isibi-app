import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeartRateZones } from "@/components/charts/lib/fitness"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heart-rate zones</CardTitle>
        <CardDescription>Minutes in each zone across the week</CardDescription>
      </CardHeader>
      <CardContent>
        <HeartRateZones maxHr={192} minutesInZone={[186, 142, 61, 34, 11]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most of the hours were easy <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Max 192 bpm
        </div>
      </CardFooter>
    </Card>
  )
}

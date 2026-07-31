import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IrrigationSchedule } from "@/components/charts/lib/agri"
let m = 32
const days = Array.from({ length: 90 }, (_, i) => {
  m -= 0.72 + Math.sin(i / 9) * 0.2
  const irrigate = m < 24.5
  if (irrigate) m = 31
  return { date: `d${i + 1}`, moisture: Number(m.toFixed(2)), irrigatedMm: irrigate ? 22 : undefined }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Soil moisture</CardTitle>
        <CardDescription>Against the refill point</CardDescription>
      </CardHeader>
      <CardContent>
        <IrrigationSchedule days={days} fieldCapacity={34} wiltingPoint={18} refillFraction={0.42} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Water before it hits the stressed band <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One season
        </div>
      </CardFooter>
    </Card>
  )
}

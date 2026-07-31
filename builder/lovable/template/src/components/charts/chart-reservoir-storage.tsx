import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReservoirStorage } from "@/components/charts/lib/water"
const M = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
const control = [0.62, 0.72, 0.84, 0.92, 0.96, 0.97, 0.94, 0.88, 0.79, 0.7, 0.62, 0.56]
const months = M.map((label, i) => ({ label, percentFull: Number(Math.max(0.28, control[i] - 0.07 - i * 0.021).toFixed(3)) }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservoir against the control curve</CardTitle>
        <CardDescription>Percentage full needs a season</CardDescription>
      </CardHeader>
      <CardContent>
        <ReservoirStorage months={months} control={control} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          60% in March is not 60% in September <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Rolling year
        </div>
      </CardFooter>
    </Card>
  )
}

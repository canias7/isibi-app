import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadiocarbonCalibration } from "@/components/charts/lib/archaeology"
// a Hallstatt-style plateau: the curve runs flat across four centuries
const curve = Array.from({ length: 90 }, (_, i) => {
  const cal = -800 + i * 10
  const flat = cal > -750 && cal < -400
  return { calendar: cal, bp: flat ? 2450 + Math.sin(cal / 40) * 18 : 2450 - (cal + 575) * 0.92 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radiocarbon</CardTitle>
        <CardDescription>A determination through the calibration curve</CardDescription>
      </CardHeader>
      <CardContent>
        <RadiocarbonCalibration bp={2450} sigma={30} curve={curve} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The plateau widens a precise measurement <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          2σ range
        </div>
      </CardFooter>
    </Card>
  )
}

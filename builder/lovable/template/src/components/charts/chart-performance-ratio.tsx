import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PerformanceRatio } from "@/components/charts/lib/solar"
const months = [
  { label: "J", kwh: 288, irradianceKwhM2: 31 },
  { label: "F", kwh: 468, irradianceKwhM2: 48 },
  { label: "M", kwh: 852, irradianceKwhM2: 87 },
  { label: "A", kwh: 1224, irradianceKwhM2: 128 },
  { label: "M", kwh: 1476, irradianceKwhM2: 152 },
  { label: "J", kwh: 1452, irradianceKwhM2: 156 },
  { label: "J", kwh: 1488, irradianceKwhM2: 161 },
  { label: "A", kwh: 1320, irradianceKwhM2: 141 },
  { label: "S", kwh: 1032, irradianceKwhM2: 106 },
  { label: "O", kwh: 636, irradianceKwhM2: 66 },
  { label: "N", kwh: 348, irradianceKwhM2: 37 },
  { label: "D", kwh: 216, irradianceKwhM2: 24 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance ratio</CardTitle>
        <CardDescription>Metered against what the sun gave</CardDescription>
      </CardHeader>
      <CardContent>
        <PerformanceRatio months={months} kwp={12} target={0.8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Generating most and performing best are different months <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          12 kWp, one year
        </div>
      </CardFooter>
    </Card>
  )
}

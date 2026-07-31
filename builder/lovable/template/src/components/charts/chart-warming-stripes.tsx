import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WarmingStripes } from "@/components/charts/lib/climate"
let s = 71
const j = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 0.34
const years = Array.from({ length: 125 }, (_, i) => {
  const year = 1900 + i
  const trend = i < 70 ? -0.24 + i * 0.0035 : -0.24 + 70 * 0.0035 + (i - 70) * 0.021
  return { year, anomaly: Number((trend + j()).toFixed(2)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A stripe a year</CardTitle>
        <CardDescription>Anomaly against the baseline</CardDescription>
      </CardHeader>
      <CardContent>
        <WarmingStripes years={years} baselineFrom={1961} baselineTo={1990} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Hatched below, solid above <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1900 to 2024
        </div>
      </CardFooter>
    </Card>
  )
}

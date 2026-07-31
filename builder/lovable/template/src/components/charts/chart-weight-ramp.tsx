import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WeightRamp } from "@/components/charts/lib/typography"
const weights = [
  { weight: 100, stemPx: 0.62 }, { weight: 200, stemPx: 0.84 },
  { weight: 300, stemPx: 1.06 }, { weight: 400, stemPx: 1.34 },
  { weight: 500, stemPx: 1.51 }, { weight: 600, stemPx: 1.62 },
  { weight: 700, stemPx: 2.04 }, { weight: 900, stemPx: 2.66 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight ramp</CardTitle>
        <CardDescription>Measured stem width, not the numeric name</CardDescription>
      </CardHeader>
      <CardContent>
        <WeightRamp weights={weights} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          500 and 600 will not read as different <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Seven weights
        </div>
      </CardFooter>
    </Card>
  )
}

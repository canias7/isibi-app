import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SoilingDecay } from "@/components/charts/lib/solar"
const readings = [
  { day: 0, ratio: 1 }, { day: 10, ratio: 0.992 }, { day: 20, ratio: 0.984 },
  { day: 35, ratio: 0.972 }, { day: 50, ratio: 0.961 }, { day: 70, ratio: 0.946 },
  { day: 90, ratio: 0.932 }, { day: 120, ratio: 0.910 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Soiling</CardTitle>
        <CardDescription>The interval that minimises both costs</CardDescription>
      </CardHeader>
      <CardContent>
        <SoilingDecay readings={readings} cleanCost={640} dailyRevenueAtFull={186} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cleaning more often is a different point on the curve <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          480 kWp, roadside
        </div>
      </CardFooter>
    </Card>
  )
}

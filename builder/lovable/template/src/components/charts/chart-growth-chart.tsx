import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GrowthChart, Audiogram, EcgStrip, DoseResponse, BloodPressure, LabResults } from "./lib/health"

const ages = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const shape = (base: number, gain: number) => ages.map((a) => +(base + gain * Math.log1p(a / 3)).toFixed(1))
const percentiles = {
  P3: shape(2.5, 2.6), P15: shape(2.9, 2.9), P50: shape(3.4, 3.2),
  P85: shape(3.9, 3.5), P97: shape(4.3, 3.8),
}
const child = [
  { age: 0, value: 3.3 }, { age: 3, value: 5.6 }, { age: 6, value: 7.1 },
  { age: 12, value: 8.9 }, { age: 18, value: 9.9 }, { age: 24, value: 10.6 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth Chart</CardTitle>
        <CardDescription>One child through the percentile curves.</CardDescription>
      </CardHeader>
      <CardContent>
        <GrowthChart ages={ages} percentiles={percentiles} child={child} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tracking the 50th steadily <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

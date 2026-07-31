import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PowerCurve } from "@/components/charts/lib/cycling"
const cp = 288, wPrime = 21500
const efforts = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600].map((seconds) => ({
  seconds,
  watts: Math.round(cp + wPrime / seconds - (seconds > 1200 ? (seconds - 1200) * 0.006 : 0)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Power duration</CardTitle>
        <CardDescription>Critical power and W′ fitted from the efforts</CardDescription>
      </CardHeader>
      <CardContent>
        <PowerCurve efforts={efforts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The battery above CP decides a sprint <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Log duration
        </div>
      </CardFooter>
    </Card>
  )
}

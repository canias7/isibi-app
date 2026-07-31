import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LafferCurve } from "@/components/charts/lib/econ"
const points = Array.from({ length: 41 }, (_, i) => {
  const rate = i / 40
  return { rate, revenue: Number((rate * Math.pow(1 - rate, 0.72) * 100).toFixed(2)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate against revenue</CardTitle>
        <CardDescription>Where the peak actually is</CardDescription>
      </CardHeader>
      <CardContent>
        <LafferCurve points={points} currentRate={0.33} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The peak is read off the curve <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Illustrative
        </div>
      </CardFooter>
    </Card>
  )
}

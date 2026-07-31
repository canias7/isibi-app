import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EarnedValue } from "@/components/charts/lib/civil"
const periods = Array.from({ length: 9 }, (_, i) => {
  const m = i + 1
  const planned = Math.round(2400000 * (1 / (1 + Math.exp(-(m - 9) / 2.6))))
  const earned = Math.round(planned * (0.99 - m * 0.021))
  return { label: `M${m}`, planned, earned, actual: Math.round(earned * (1.02 + m * 0.011)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Earned value</CardTitle>
        <CardDescription>Planned, earned and actual to date</CardDescription>
      </CardHeader>
      <CardContent>
        <EarnedValue periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Behind schedule and over cost <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Month 9 of 18
        </div>
      </CardFooter>
    </Card>
  )
}

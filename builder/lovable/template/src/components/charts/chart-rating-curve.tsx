import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RatingCurve } from "@/components/charts/lib/water"
const q = (h: number) => 32 * Math.pow(Math.max(0, h - 0.12), 1.62)
const fitted = Array.from({ length: 60 }, (_, i) => {
  const stage = 0.15 + i * 0.055
  return { stage: Number(stage.toFixed(3)), discharge: Number(q(stage).toFixed(1)) }
})
const gaugings = [0.2, 0.34, 0.51, 0.72, 0.95, 1.18, 1.44, 1.7].map((stage) => ({
  stage, discharge: Number((q(stage) * (0.96 + (stage % 0.13))).toFixed(1)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage to discharge</CardTitle>
        <CardDescription>Measured, then extrapolated</CardDescription>
      </CardHeader>
      <CardContent>
        <RatingCurve gaugings={gaugings} fitted={fitted} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most floods are beyond the last gauging <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One gauge
        </div>
      </CardFooter>
    </Card>
  )
}

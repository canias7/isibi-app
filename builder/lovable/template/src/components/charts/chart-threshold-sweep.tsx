import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThresholdSweep } from "@/components/charts/lib/mldata"
const points = Array.from({ length: 49 }, (_, i) => {
  const threshold = 0.02 + i * 0.02
  const recall = 1 / (1 + Math.exp((threshold - 0.42) * 9))
  const precision = 1 / (1 + Math.exp(-(threshold - 0.2) * 6.5)) * 0.93
  return { threshold, precision, recall }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choosing the cut-off</CardTitle>
        <CardDescription>Precision, recall and F1 by threshold</CardDescription>
      </CardHeader>
      <CardContent>
        <ThresholdSweep points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The best cut-off is rarely 0.5 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Held-out set
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RocCurve, PrecisionRecall, ConfusionMatrix, CalibrationPlot, GainsChart, LiftChart, FeatureImportance, ContributionWaterfall } from "./lib/modeleval"

const points = Array.from({ length: 11 }, (_, i) => {
  const population = i / 10
  return { population, captured: Math.min(1, Math.pow(population, 0.52)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Gains</CardTitle>
        <CardDescription>What share of bookers the top slice captures.</CardDescription>
      </CardHeader>
      <CardContent>
        <GainsChart points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The top 20% holds 58% of them <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

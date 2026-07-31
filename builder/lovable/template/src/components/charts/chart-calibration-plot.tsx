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

const bins = [
  { predicted: 0.05, observed: 0.04, count: 240 },
  { predicted: 0.15, observed: 0.13, count: 190 },
  { predicted: 0.25, observed: 0.26, count: 150 },
  { predicted: 0.35, observed: 0.33, count: 120 },
  { predicted: 0.45, observed: 0.47, count: 96 },
  { predicted: 0.55, observed: 0.52, count: 80 },
  { predicted: 0.65, observed: 0.6, count: 64 },
  { predicted: 0.75, observed: 0.68, count: 50 },
  { predicted: 0.85, observed: 0.76, count: 36 },
  { predicted: 0.95, observed: 0.84, count: 22 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration Plot</CardTitle>
        <CardDescription>Does a 70% prediction happen 70% of the time?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <CalibrationPlot bins={bins} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Slightly over-confident at the top <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

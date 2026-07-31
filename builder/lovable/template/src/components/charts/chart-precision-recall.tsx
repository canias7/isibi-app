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

const points = Array.from({ length: 21 }, (_, i) => {
  const recall = i / 20
  return { recall, precision: Math.max(0.12, 0.95 - Math.pow(recall, 1.7) * 0.8) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Precision-Recall</CardTitle>
        <CardDescription>Better than ROC when positives are rare.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <PrecisionRecall points={points} baseRate={0.12} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Holds above 0.6 to halfway <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

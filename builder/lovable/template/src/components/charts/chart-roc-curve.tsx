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

const mk = (k: number) => Array.from({ length: 21 }, (_, i) => {
  const fpr = i / 20
  return { fpr, tpr: Math.min(1, Math.pow(fpr, 1 / k)) }
})
const curves = [
  { label: "Gradient boosting", points: mk(3.2) },
  { label: "Logistic regression", points: mk(1.9) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ROC Curve</CardTitle>
        <CardDescription>True positives against false positives.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <RocCurve curves={curves} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Both beat the 0.5 chance line <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

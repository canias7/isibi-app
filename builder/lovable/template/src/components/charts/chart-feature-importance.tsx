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

const features = [
  { label: "Days since visit", value: 0.34 },
  { label: "Visit count", value: 0.22 },
  { label: "Avg spend", value: 0.16 },
  { label: "Weekend booker", value: 0.11 },
  { label: "Service mix", value: 0.08 },
  { label: "Channel", value: 0.06 },
  { label: "Reminder opened", value: 0.03 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Importance</CardTitle>
        <CardDescription>What the model leans on.</CardDescription>
      </CardHeader>
      <CardContent>
        <FeatureImportance features={features} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Days since last visit dominates <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

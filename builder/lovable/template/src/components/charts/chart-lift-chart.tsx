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

const deciles = [3.1, 2.3, 1.7, 1.3, 1.05, 0.85, 0.66, 0.5, 0.34, 0.22]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lift Chart</CardTitle>
        <CardDescription>How much better than random each decile is.</CardDescription>
      </CardHeader>
      <CardContent>
        <LiftChart deciles={deciles} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The top decile is 3.1x random <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

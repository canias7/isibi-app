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

const classes = ["Kept", "Moved", "Cancelled"]
const matrix = [
  [812, 41, 27],
  [63, 214, 38],
  [44, 31, 96],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confusion Matrix</CardTitle>
        <CardDescription>Predicted against actual, shaded by row.</CardDescription>
      </CardHeader>
      <CardContent>
        <ConfusionMatrix classes={classes} matrix={matrix} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cancellations are the hard class <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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

const contributions = [
  { label: "Days since visit", value: 0.18 },
  { label: "Visit count", value: 0.11 },
  { label: "Avg spend", value: -0.07 },
  { label: "Weekend booker", value: 0.05 },
  { label: "Channel", value: -0.03 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution Waterfall</CardTitle>
        <CardDescription>How one prediction was reached.</CardDescription>
      </CardHeader>
      <CardContent>
        <ContributionWaterfall base={0.32} contributions={contributions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Recency pushed this one up hardest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuantileDotPlot, IconArray, SurvivalBand, CumulativeIncidence, SubgroupForest, DecisionCurve, UpliftCurve, PowerCurve } from "./lib/stats3"

const model = Array.from({ length: 41 }, (_, i) => {
  const threshold = i / 80
  return { threshold, netBenefit: Math.max(-0.02, 0.13 - Math.pow(threshold * 2.6, 2) * 0.12) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision Curve</CardTitle>
        <CardDescription>Net benefit against the threshold you would act at.</CardDescription>
      </CardHeader>
      <CardContent>
        <DecisionCurve model={model} prevalence={0.14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Worth using between 10% and 45% <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

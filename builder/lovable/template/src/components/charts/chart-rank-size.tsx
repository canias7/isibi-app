import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Raincloud, SinaPlot, LetterValuePlot, BackToBackHistogram, Ogive, DensityOverlay, LorenzCurve, RankSizePlot, PyramidHistogram, JointPlot, MirrorDensity } from "./lib/distributions2"

const values = Array.from({ length: 120 }, (_, i) => Math.round(4200 / Math.pow(i + 1, 1.05)))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rank-Size</CardTitle>
        <CardDescription>Value against rank, both axes log.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <RankSizePlot values={values} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Close to a straight line — a power law <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

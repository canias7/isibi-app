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

function rnd(seed = 1) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 100000) / 100000 }
}

const r = rnd(37)
const values = Array.from({ length: 300 }, () => Math.pow(r(), 2.4) * 900 + 5)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lorenz Curve</CardTitle>
        <CardDescription>How concentrated revenue is across customers.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <LorenzCurve values={values} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The top fifth is just over half <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

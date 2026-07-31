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

const r = rnd(23)
const values = Array.from({ length: 300 }, () => Math.round(30 + ((r() + r() + r()) / 3 - 0.5) * 60))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ogive</CardTitle>
        <CardDescription>The running total across the bins.</CardDescription>
      </CardHeader>
      <CardContent>
        <Ogive values={values} format={(n) => "£" + n} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nine in ten are under £55 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

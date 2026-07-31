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

const bell = (n: number, c: number, sp: number, seed: number) => {
  const r = rnd(seed)
  return Array.from({ length: n }, () => c + ((r() + r() + r()) / 3 - 0.5) * sp * 4)
}
const weekday = bell(200, 28, 8, 5)
const weekend = bell(200, 41, 11, 9)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mirror Density</CardTitle>
        <CardDescription>Two smooth distributions, back to back.</CardDescription>
      </CardHeader>
      <CardContent>
        <MirrorDensity top={weekend} bottom={weekday} labels={["Weekend", "Weekday"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Weekends sit clearly to the right <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

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
const series = [
  { label: "Returning", values: bell(200, 42, 14, 3) },
  { label: "New", values: bell(200, 28, 8, 11) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Density Overlay</CardTitle>
        <CardDescription>Two smooth distributions on one axis.</CardDescription>
      </CardHeader>
      <CardContent>
        <DensityOverlay series={series} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          New customers spend less, and more tightly <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

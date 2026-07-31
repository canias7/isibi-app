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
  return Array.from({ length: n }, () => Math.round(c + ((r() + r() + r()) / 3 - 0.5) * sp * 4))
}
const groups = [
  { label: "Cuts", values: bell(70, 24, 5, 3) },
  { label: "Beard", values: bell(70, 15, 4, 7) },
  { label: "Colour", values: bell(70, 60, 15, 11) },
  { label: "Towel", values: bell(70, 20, 5, 13) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sina Plot</CardTitle>
        <CardDescription>Points spread by their own local density.</CardDescription>
      </CardHeader>
      <CardContent>
        <SinaPlot groups={groups} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The pile-ups are visible, unlike a jitter <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

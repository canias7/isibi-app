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

const r = rnd(19)
const points = Array.from({ length: 140 }, () => {
  const x = r() * 60 + 5
  return { x, y: 12 + x * 0.9 + (r() + r() - 1) * 18 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Joint Plot</CardTitle>
        <CardDescription>A scatter with both margins drawn.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <JointPlot points={points} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Duration is skewed, spend is not <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

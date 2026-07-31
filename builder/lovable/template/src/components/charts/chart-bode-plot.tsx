import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BodePlot, NyquistPlot, SmithChart, Lissajous, Waveform, EyeDiagram, ConstellationDiagram, StressStrain, SnCurve, RecurrencePlot, srnd } from "./lib/signals"

const points = Array.from({ length: 40 }, (_, i) => {
  const freq = Math.pow(10, 1 + (i / 39) * 3)
  const w = freq / 400
  return { freq, gainDb: -10 * Math.log10(1 + w * w), phaseDeg: (-Math.atan(w) * 180) / Math.PI }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bode Plot</CardTitle>
        <CardDescription>Gain and phase against log frequency.</CardDescription>
      </CardHeader>
      <CardContent>
        <BodePlot points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A low-pass with its corner marked <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

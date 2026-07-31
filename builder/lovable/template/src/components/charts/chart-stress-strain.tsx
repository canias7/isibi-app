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

const points = Array.from({ length: 50 }, (_, i) => {
  const e = (i / 49) * 0.12
  const stress = e < 0.02 ? e * 11000 : 220 + 160 * (1 - Math.exp(-(e - 0.02) * 28)) - (e > 0.09 ? (e - 0.09) * 2600 : 0)
  return { strain: e, stress }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stress-Strain</CardTitle>
        <CardDescription>The tensile test with its named points.</CardDescription>
      </CardHeader>
      <CardContent>
        <StressStrain points={points} yieldAt={9} ultimateAt={37} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ductile — a long run past yield <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

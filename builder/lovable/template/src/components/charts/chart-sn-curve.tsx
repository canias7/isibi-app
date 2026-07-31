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

const points = Array.from({ length: 22 }, (_, i) => {
  const cycles = Math.pow(10, 3 + (i / 21) * 4)
  const jitter = ((i * 37) % 11) - 5
  return { cycles, stress: Math.max(182, 460 - 62 * Math.log10(cycles / 1000)) + jitter }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>S-N Curve</CardTitle>
        <CardDescription>Stress against cycles to failure.</CardDescription>
      </CardHeader>
      <CardContent>
        <SnCurve points={points} enduranceLimit={185} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An endurance limit appears at a million cycles <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

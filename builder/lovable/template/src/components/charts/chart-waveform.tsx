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

const r = srnd(9)
const samples = Array.from({ length: 90 }, (_, i) => {
  const env = i < 18 ? 0.3 : i < 40 ? 0.85 : i < 58 ? 0.45 : i < 80 ? 0.95 : 0.25
  return env * (0.55 + r() * 0.45) * (i % 2 ? 1 : -1)
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waveform</CardTitle>
        <CardDescription>An amplitude envelope with a playhead.</CardDescription>
      </CardHeader>
      <CardContent>
        <Waveform samples={samples} playhead={0.62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The chorus is the loud block <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

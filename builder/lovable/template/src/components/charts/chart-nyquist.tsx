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

const points = Array.from({ length: 60 }, (_, i) => {
  const w = Math.pow(10, -1 + (i / 59) * 2.4)
  const d = 1 + w * w
  return { re: 1 / d - 0.15, im: -w / d }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nyquist Plot</CardTitle>
        <CardDescription>The response in the complex plane.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <NyquistPlot points={points} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Clear of the critical point <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

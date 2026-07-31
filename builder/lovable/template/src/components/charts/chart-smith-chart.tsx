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

const trace = Array.from({ length: 30 }, (_, i) => {
  const t = i / 29
  return { r: 0.25 + t * 0.75, x: 1.4 * (1 - t) - 0.15 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Smith Chart</CardTitle>
        <CardDescription>An impedance sweep towards the match.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SmithChart trace={trace} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ends near the centre — matched <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

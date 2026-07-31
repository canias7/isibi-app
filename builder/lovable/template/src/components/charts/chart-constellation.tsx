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

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Constellation</CardTitle>
        <CardDescription>Received symbols around the 16-QAM grid.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ConstellationDiagram />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tight clouds — clean demodulation <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

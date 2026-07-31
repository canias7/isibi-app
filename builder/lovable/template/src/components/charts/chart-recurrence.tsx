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

const values = Array.from({ length: 56 }, (_, i) => Math.sin(i / 3.1) + Math.sin(i / 8.7) * 0.5)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurrence Plot</CardTitle>
        <CardDescription>When the system revisits a state.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <RecurrencePlot values={values} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The stripes are the repeating motif <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

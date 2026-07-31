import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spectrogram, PhasePortrait, PoincarePlot, Bifurcation, Streamlines, Nomogram, sampleFrames } from "./lib/science"

const values = Array.from({ length: 220 }, (_, i) => 50 + Math.sin(i / 9) * 22 + Math.sin(i / 31) * 6)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase Portrait</CardTitle>
        <CardDescription>Value against its own rate of change.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <PhasePortrait values={values} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It orbits — the series is cyclical <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

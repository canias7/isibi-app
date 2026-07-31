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

const field = (x: number, y: number): [number, number] => [0.8 + Math.sin(y * Math.PI * 2) * 0.5, Math.cos(x * Math.PI * 2) * 0.5]
const seeds = Array.from({ length: 14 }, (_, i) => ({ x: 0.03, y: (i + 0.5) / 14 }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Streamlines</CardTitle>
        <CardDescription>Paths traced through a vector field.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Streamlines field={field} seeds={seeds} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Everything drains to the right <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

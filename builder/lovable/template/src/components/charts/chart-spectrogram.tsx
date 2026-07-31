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

const frames = sampleFrames(110, 44)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spectrogram</CardTitle>
        <CardDescription>Time across, frequency up, intensity as shade.</CardDescription>
      </CardHeader>
      <CardContent>
        <Spectrogram frames={frames} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rising tone over a steady hum <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

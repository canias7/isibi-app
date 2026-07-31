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

const scales = [
  { label: "Minutes", min: 10, max: 90, format: (n: number) => n + "m" },
  { label: "Price", min: 8, max: 70, format: (n: number) => "£" + n },
  { label: "£ per hour", min: 10, max: 90, format: (n: number) => "£" + n },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nomogram</CardTitle>
        <CardDescription>Lay a line across the scales to read the answer.</CardDescription>
      </CardHeader>
      <CardContent>
        <Nomogram scales={scales} example={[35, 24, 41]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          35 minutes at £24 gives £41 an hour <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

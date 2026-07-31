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

const values = Array.from({ length: 260 }, (_, i) => 60 + Math.sin(i / 7) * 9 + ((i * 43) % 11) - 5)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Poincaré Plot</CardTitle>
        <CardDescription>Each value against the next.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <PoincarePlot values={values} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A tight cloud — low short-term variability <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

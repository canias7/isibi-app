import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HarmonicSeries } from "@/components/charts/lib/chem"
const partials = Array.from({ length: 16 }, (_, i) => ({
  n: i + 1,
  amplitude: Number((1 / (i + 1) ** 0.9).toFixed(3)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Harmonic series</CardTitle>
        <CardDescription>Partials of a low A</CardDescription>
      </CardHeader>
      <CardContent>
        <HarmonicSeries fundamental={110} partials={partials} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Amplitude falls roughly as 1/n <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Fundamental 110 Hz
        </div>
      </CardFooter>
    </Card>
  )
}

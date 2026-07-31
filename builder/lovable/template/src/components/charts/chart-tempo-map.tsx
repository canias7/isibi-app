import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TempoMap } from "@/components/charts/lib/music2"
let s = 55
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const points = Array.from({ length: 64 }, (_, i) => {
  const bar = i + 1
  const phrase = bar > 40 && bar < 53 ? -14 * Math.sin(((bar - 40) / 12) * Math.PI) : 0
  const rit = bar > 56 ? -(bar - 56) * 2.4 : 0
  return {
    bar,
    bpm: Math.round(92 + phrase + rit + (rnd() - 0.5) * 3),
    marking: bar === 1 ? "Allegro" : bar === 41 ? "rubato" : bar === 57 ? "rit." : undefined,
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempo map</CardTitle>
        <CardDescription>Beat tempo through a movement</CardDescription>
      </CardHeader>
      <CardContent>
        <TempoMap points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The rubato is in bars 41 to 52 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Live performance
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PestTrapping } from "@/components/charts/lib/museum"
let s = 91
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const mk = (base: number, spikeFrom: number, spike: number) =>
  Array.from({ length: 24 }, (_, w) => Math.max(0, Math.round(base + (rnd() - 0.5) * base * 0.8 + (w >= spikeFrom ? spike : 0))))
const zones = [
  { name: "Store 2, basement", species: "Webbing clothes moth", catches: mk(5, 99, 0) },
  { name: "Gallery 4", species: "Webbing clothes moth", catches: mk(0.4, 16, 4) },
  { name: "Loading bay", species: "Carpet beetle", catches: mk(3, 99, 0) },
  { name: "Textile store", species: "Case-bearing moth", catches: mk(2, 19, 9) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pest trapping</CardTitle>
        <CardDescription>Each zone against its own baseline</CardDescription>
      </CardHeader>
      <CardContent>
        <PestTrapping zones={zones} baselineWeeks={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A single threshold would miss the gallery <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twenty-four weeks
        </div>
      </CardFooter>
    </Card>
  )
}

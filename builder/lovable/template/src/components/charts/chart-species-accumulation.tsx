import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpeciesAccumulation } from "@/components/charts/lib/ecology"
let s = 11
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
let acc = 0
const samples = Array.from({ length: 40 }, (_, i) => {
  const expected = (68 * (i + 1)) / (7 + i + 1)
  acc = Math.max(acc, Math.round(expected + (rnd() - 0.45) * 2.4))
  return acc
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Species accumulation</CardTitle>
        <CardDescription>Richness against sampling effort</CardDescription>
      </CardHeader>
      <CardContent>
        <SpeciesAccumulation samples={samples} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The asymptote is fitted, not assumed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          40 pitfall traps
        </div>
      </CardFooter>
    </Card>
  )
}

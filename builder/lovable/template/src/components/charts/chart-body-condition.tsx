import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BodyCondition } from "@/components/charts/lib/herd"
let s = 27
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const mk = (id: string, start: number, loss: number) => ({
  id,
  scores: [0, 21, 42, 63, 84, 120, 160, 210].map((dim) => ({
    dim,
    bcs: start - loss * (1 - Math.exp(-dim / 45)) + (dim > 120 ? (dim - 120) * 0.0022 : 0) + (rnd() - 0.5) * 0.06,
  })),
})
const cows = [
  mk("2841", 3.25, 0.55), mk("2903", 3.5, 0.95), mk("3011", 3.0, 0.4),
  mk("3055", 3.75, 1.15), mk("3102", 3.25, 0.62), mk("3140", 3.0, 0.85),
]
const target = [0, 21, 42, 63, 84, 120, 160, 210].map((dim) => ({ dim, bcs: 3.25 - 0.5 * (1 - Math.exp(-dim / 45)) + (dim > 120 ? (dim - 120) * 0.0028 : 0) }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Body condition</CardTitle>
        <CardDescription>Loss through early lactation, per cow</CardDescription>
      </CardHeader>
      <CardContent>
        <BodyCondition cows={cows} target={target} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The loss predicts the missed service <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve cows
        </div>
      </CardFooter>
    </Card>
  )
}

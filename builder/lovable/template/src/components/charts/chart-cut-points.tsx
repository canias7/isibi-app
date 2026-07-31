import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CutPoints } from "@/components/charts/lib/spirits"
const run = Array.from({ length: 26 }, (_, i) => {
  const abv = 84 - Math.pow(i / 25, 1.7) * 66
  const heads = Math.exp(-Math.pow((i - 1) / 2.2, 2)) * 240
  const tails = Math.exp(-Math.pow((i - 24) / 5.4, 2)) * 310
  return {
    litres: 12,
    abv: Math.round(abv * 10) / 10,
    congeners: Math.round(28 + heads + tails),
  }
})
const cuts = [
  { name: "Tight", from: 4, to: 16 },
  { name: "House", from: 3, to: 19 },
  { name: "Wide", from: 2, to: 22 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spirit cut</CardTitle>
        <CardDescription>The consequence of a decision made by nose</CardDescription>
      </CardHeader>
      <CardContent>
        <CutPoints run={run} cuts={cuts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A wider cut is more spirit and a different spirit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Second distillation
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EditRhythm } from "@/components/charts/lib/media"
let s = 41
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const cuts: number[] = []
let t = 0
while (t < 108) {
  const fast = (t > 62 && t < 74) || t > 96
  t += (fast ? 0.02 : 0.09) * (0.3 + r() * 1.7)
  cuts.push(Number(t.toFixed(3)))
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cutting rate over the film</CardTitle>
        <CardDescription>Pace is a curve</CardDescription>
      </CardHeader>
      <CardContent>
        <EditRhythm cuts={cuts.filter((c) => c <= 108)} runtimeMin={108} windowMin={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The climax shows as a spike <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          108 minutes
        </div>
      </CardFooter>
    </Card>
  )
}

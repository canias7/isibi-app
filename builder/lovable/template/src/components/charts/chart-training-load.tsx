import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrainingLoad } from "@/components/charts/lib/fitness"
let s = 42
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const daily = Array.from({ length: 84 }, (_, i) => {
  const base = 260 + Math.sin(i / 9) * 90 + (i > 55 && i < 70 ? 210 : 0)
  return i % 7 === 6 ? 0 : Math.max(0, Math.round(base + (rnd() - 0.5) * 120))
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Training load</CardTitle>
        <CardDescription>Acute against chronic workload</CardDescription>
      </CardHeader>
      <CardContent>
        <TrainingLoad daily={daily} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Above 1.5 the injury rate climbs <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve weeks
        </div>
      </CardFooter>
    </Card>
  )
}

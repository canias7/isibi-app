import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShotLength } from "@/components/charts/lib/media"
let s = 29
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const shots = Array.from({ length: 180 }, (_, i) => {
  const action = i > 100 && i < 140
  const base = action ? 0.8 : 3.4
  return Number((base * (0.4 + r() * 1.6) + (r() > 0.97 ? 14 * r() : 0)).toFixed(2))
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Every shot in order</CardTitle>
        <CardDescription>Cutting rhythm</CardDescription>
      </CardHeader>
      <CardContent>
        <ShotLength shots={shots} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Mean and median disagree for a reason <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One reel
        </div>
      </CardFooter>
    </Card>
  )
}

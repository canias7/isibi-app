import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FloatHistogram } from "@/components/charts/lib/civil"
let s = 3
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const activities = Array.from({ length: 320 }, (_, i) => ({
  name: `A${i}`,
  floatDays: i < 41 ? 0 : Math.round(Math.pow(rnd(), 2.2) * 74),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule float</CardTitle>
        <CardDescription>How much slack every activity holds</CardDescription>
      </CardHeader>
      <CardContent>
        <FloatHistogram activities={activities} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A fifth of the programme has no float <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          320-activity programme
        </div>
      </CardFooter>
    </Card>
  )
}

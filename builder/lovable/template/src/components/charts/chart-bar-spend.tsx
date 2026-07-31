import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarSpend } from "@/components/charts/lib/events"
let s = 12
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const observations = Array.from({ length: 140 }, () => {
  const dwellMinutes = Math.round(30 + rnd() * 180)
  return { dwellMinutes, spend: Math.max(0, 4.2 + dwellMinutes * 0.098 + (rnd() - 0.5) * 9) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bar spend</CardTitle>
        <CardDescription>What an extra minute in the venue is worth</CardDescription>
      </CardHeader>
      <CardContent>
        <BarSpend observations={observations} attendance={4200} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The argument for a support act <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          4,200 attending
        </div>
      </CardFooter>
    </Card>
  )
}

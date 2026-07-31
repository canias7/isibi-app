import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DwellTime } from "@/components/charts/lib/transit2"
let s = 77
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const observations = Array.from({ length: 180 }, () => {
  const pax = Math.round(Math.pow(rnd(), 1.7) * 34)
  return { passengers: pax, seconds: Math.round(12.4 + pax * 1.85 + (rnd() - 0.5) * 9) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dwell decomposition</CardTitle>
        <CardDescription>Door cycle separated from passenger service</CardDescription>
      </CardHeader>
      <CardContent>
        <DwellTime observations={observations} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Twelve seconds go before anyone moves <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          180 observed stops
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalvingInterval } from "@/components/charts/lib/herd"
let s = 71
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const cows = Array.from({ length: 16 }, (_, i) => ({
  id: `C${2800 + i * 17}`,
  intervalDays: Math.round(358 + Math.pow(rnd(), 3) * 160),
  parity: 1 + Math.floor(rnd() * 5),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calving interval</CardTitle>
        <CardDescription>Each cow against the 365-day target</CardDescription>
      </CardHeader>
      <CardContent>
        <CalvingInterval cows={cows} costPerExtraDay={4.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The herd mean is the wrong number <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          £4.20 per extra day
        </div>
      </CardFooter>
    </Card>
  )
}

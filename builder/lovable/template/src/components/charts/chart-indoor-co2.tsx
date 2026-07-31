import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IndoorCo2 } from "@/components/charts/lib/airquality"
const trace: number[] = []
let c = 480
for (let i = 0; i < 96; i++) {
  const occupied = i > 6 && i < 84 && !(i > 42 && i < 52)
  const target = occupied ? 1640 : 470
  c += (target - c) * 0.11
  trace.push(c)
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Indoor CO₂</CardTitle>
        <CardDescription>Ventilation per person solved from the steady state</CardDescription>
      </CardHeader>
      <CardContent>
        <IndoorCo2 trace={trace} occupants={28} minutesPerSample={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          CO₂ is the tracer, not the hazard <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          28-person classroom
        </div>
      </CardFooter>
    </Card>
  )
}

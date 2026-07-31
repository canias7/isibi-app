import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TherapeuticWindow } from "@/components/charts/lib/pharma"
const trace: number[] = []
let c = 0
for (let h = 0; h < 96; h++) {
  if (h % 12 === 0) c += 14
  c *= Math.exp(-0.085)
  trace.push(c)
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Therapeutic window</CardTitle>
        <CardDescription>Repeat dosing against the floor and ceiling</CardDescription>
      </CardHeader>
      <CardContent>
        <TherapeuticWindow trace={trace} minimumEffective={8} toxicThreshold={22} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Fifteen percent of the day is sub-therapeutic <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve-hourly
        </div>
      </CardFooter>
    </Card>
  )
}

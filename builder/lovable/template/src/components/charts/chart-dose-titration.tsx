import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DoseTitration } from "@/components/charts/lib/pharma"
const steps = [
  { dose: 5, responders: 8, adverse: 2, n: 60 },
  { dose: 10, responders: 17, adverse: 4, n: 60 },
  { dose: 20, responders: 29, adverse: 7, n: 60 },
  { dose: 40, responders: 41, adverse: 14, n: 60 },
  { dose: 80, responders: 50, adverse: 27, n: 60 },
  { dose: 160, responders: 55, adverse: 41, n: 60 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dose titration</CardTitle>
        <CardDescription>Response and adverse events against dose</CardDescription>
      </CardHeader>
      <CardContent>
        <DoseTitration steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A therapeutic index under three needs monitoring <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Phase II
        </div>
      </CardFooter>
    </Card>
  )
}

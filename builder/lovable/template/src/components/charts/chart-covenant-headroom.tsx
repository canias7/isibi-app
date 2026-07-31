import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CovenantHeadroom } from "@/components/charts/lib/finance3"
const covenants = [
  { name: "Net leverage", actual: 3.4, limit: 4, direction: "max" as const, unit: "×" },
  { name: "Interest cover", actual: 2.9, limit: 3, direction: "min" as const, unit: "×" },
  { name: "Gearing", actual: 0.51, limit: 0.65, direction: "max" as const },
  { name: "Tangible net worth", actual: 128, limit: 100, direction: "min" as const, unit: "m" },
  { name: "Capex", actual: 41, limit: 35, direction: "max" as const, unit: "m" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Covenant headroom</CardTitle>
        <CardDescription>Distance to each threshold, polarity normalised</CardDescription>
      </CardHeader>
      <CardContent>
        <CovenantHeadroom covenants={covenants} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Capex is the binding test <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Q2 certificate
        </div>
      </CardFooter>
    </Card>
  )
}

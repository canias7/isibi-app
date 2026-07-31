import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Laytime } from "@/components/charts/lib/shipping"
const events = [
  { name: "NOR tendered, 6 h turn time", hours: 6, counting: false },
  { name: "Discharge Tue–Wed", hours: 31, counting: true },
  { name: "Rain stoppage", hours: 5.5, counting: false },
  { name: "Discharge Thu", hours: 22, counting: true },
  { name: "Sunday, excepted", hours: 24, counting: false },
  { name: "Discharge Mon", hours: 26, counting: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Laytime statement</CardTitle>
        <CardDescription>Counted time against the allowance</CardDescription>
      </CardHeader>
      <CardContent>
        <Laytime allowedHours={72} events={events} demurrageRatePerDay={18500} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Demurrage is solved, never quoted <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          72 hours allowed
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Bioequivalence } from "@/components/charts/lib/pharma"
const parameters = [
  { name: "AUC₀₋ₜ", ratio: 102.4, ciLow: 96.1, ciHigh: 109.1 },
  { name: "AUC₀₋∞", ratio: 101.8, ciLow: 95.2, ciHigh: 108.9 },
  { name: "Cmax", ratio: 88.6, ciLow: 77.4, ciHigh: 101.4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bioequivalence</CardTitle>
        <CardDescription>90% confidence intervals against 80–125%</CardDescription>
      </CardHeader>
      <CardContent>
        <Bioequivalence parameters={parameters} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every parameter has to pass, not most <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Generic vs reference
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BunkerConsumption } from "@/components/charts/lib/shipping"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slow steaming</CardTitle>
        <CardDescription>Fuel and time charter against speed</CardDescription>
      </CardHeader>
      <CardContent>
        <BunkerConsumption
          referenceKnots={19}
          referenceTonnesPerDay={94}
          distanceNm={11200}
          fuelPricePerTonne={640}
          charterCostPerDay={48000}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The daily cost stops the cut going further <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cube law
        </div>
      </CardFooter>
    </Card>
  )
}

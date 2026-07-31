import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FuelTankering } from "@/components/charts/lib/aviation"
const sectors = [
  { name: "AMS → LHR", originPrice: 720, destinationPrice: 890, burnPenalty: 0.04, capacityT: 3.2 },
  { name: "LHR → DUB", originPrice: 890, destinationPrice: 940, burnPenalty: 0.05, capacityT: 2.6 },
  { name: "DXB → BOM", originPrice: 610, destinationPrice: 790, burnPenalty: 0.11, capacityT: 5.4 },
  { name: "SIN → SYD", originPrice: 680, destinationPrice: 745, burnPenalty: 0.22, capacityT: 8.1 },
  { name: "MAD → LIS", originPrice: 760, destinationPrice: 880, burnPenalty: 0.03, capacityT: 2.1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fuel tankering</CardTitle>
        <CardDescription>Break-even price ratio solved per sector</CardDescription>
      </CardHeader>
      <CardContent>
        <FuelTankering sectors={sectors} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A longer leg needs a bigger price gap <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five sectors
        </div>
      </CardFooter>
    </Card>
  )
}

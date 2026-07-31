import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PalletNetwork } from "@/components/charts/lib/freight"
const consignments = [
  { name: "2 pallets → Exeter", pallets: 2, miles: 180 },
  { name: "4 pallets → Newcastle", pallets: 4, miles: 240 },
  { name: "6 pallets → Norwich", pallets: 6, miles: 120 },
  { name: "9 pallets → Glasgow", pallets: 9, miles: 310 },
  { name: "12 pallets → Cardiff", pallets: 12, miles: 140 },
  { name: "18 pallets → Leeds", pallets: 18, miles: 165 },
  { name: "24 pallets → Bristol", pallets: 24, miles: 95 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hub or direct</CardTitle>
        <CardDescription>The crossover depends on the distance</CardDescription>
      </CardHeader>
      <CardContent>
        <PalletNetwork consignments={consignments} hubRatePerPallet={34} directCostPerMile={1.28} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Deciding by habit gets it wrong at both ends <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One day's part loads
        </div>
      </CardFooter>
    </Card>
  )
}

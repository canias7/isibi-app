import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FuelSurcharge } from "@/components/charts/lib/freight"
const pump = [148, 151, 158, 167, 174, 178, 172, 165, 159, 163, 171, 176]
const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((label, i) => ({
  label,
  pencePerLitre: pump[i],
  // the surcharge is set from LAST month's price, which is the whole point
  surchargePercent: Math.round(((pump[Math.max(0, i - 1)] - 150) / 150) * 0.32 * 100 * 10) / 10,
}))
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fuel surcharge</CardTitle>
        <CardDescription>What the formula owes against what was billed</CardDescription>
      </CardHeader>
      <CardContent>
        <FuelSurcharge months={months} baselinePence={150} fuelShareOfCost={0.32} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A monthly review is always behind a weekly price <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}

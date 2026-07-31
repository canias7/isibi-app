import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LensAttach } from "@/components/charts/lib/optical"
const options = [
  { name: "Anti-reflective coating", taken: 512, price: 48, cost: 9 },
  { name: "Thinner lens index", taken: 268, price: 86, cost: 31 },
  { name: "Photochromic", taken: 141, price: 92, cost: 34 },
  { name: "Varifocal upgrade", taken: 94, price: 164, cost: 58 },
  { name: "Scratch guarantee", taken: 198, price: 24, cost: 4 },
  { name: "Blue-light filter", taken: 76, price: 38, cost: 8 },
  { name: "Prescription sunglass tint", taken: 61, price: 54, cost: 16 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lens options</CardTitle>
        <CardDescription>Spread across every dispense</CardDescription>
      </CardHeader>
      <CardContent>
        <LensAttach options={options} dispenses={688} baseDispenseValue={186} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Sold one at a time, reviewed as line items <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          688 dispenses
        </div>
      </CardFooter>
    </Card>
  )
}

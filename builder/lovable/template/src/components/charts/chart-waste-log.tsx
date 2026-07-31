import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WasteLog } from "@/components/charts/lib/restaurant"
const items = [
  { name: "Beef trim", kg: 18.4, costPerKg: 14.4, reason: "Trim" },
  { name: "Leaf salad", kg: 9.1, costPerKg: 6.2, reason: "Spoilage" },
  { name: "Soft herbs", kg: 2.4, costPerKg: 22, reason: "Spoilage" },
  { name: "Gnocchi", kg: 11, costPerKg: 3.1, reason: "Over-prep" },
  { name: "Pastry cream", kg: 6.8, costPerKg: 5.4, reason: "Over-prep" },
  { name: "Sea bass", kg: 4.2, costPerKg: 19.6, reason: "Cooking error" },
  { name: "Ribeye", kg: 3.1, costPerKg: 26, reason: "Cooking error" },
  { name: "Dessert plates", kg: 5.6, costPerKg: 4.8, reason: "Comped" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waste log</CardTitle>
        <CardDescription>Where food value is lost</CardDescription>
      </CardHeader>
      <CardContent>
        <WasteLog items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trim costs more than everything comped <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Per week, at cost
        </div>
      </CardFooter>
    </Card>
  )
}

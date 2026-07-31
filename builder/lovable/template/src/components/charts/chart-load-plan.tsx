import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoadPlan } from "@/components/charts/lib/logistics"
const items = [
  { name: "Tinned goods, 12 pallets", kg: 9600, m3: 14.4 },
  { name: "Cereal, 8 pallets", kg: 1280, m3: 15.2 },
  { name: "Bottled water, 6 pallets", kg: 6300, m3: 7.2 },
  { name: "Kitchen roll, 5 pallets", kg: 420, m3: 12.5 },
  { name: "Detergent, 4 pallets", kg: 3100, m3: 4.8 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Which limit binds</CardTitle>
        <CardDescription>Weight against volume</CardDescription>
      </CardHeader>
      <CardContent>
        <LoadPlan items={items} maxKg={26000} maxM3={82} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Almost never both at once <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One trailer
        </div>
      </CardFooter>
    </Card>
  )
}

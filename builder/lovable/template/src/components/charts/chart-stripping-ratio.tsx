import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StrippingRatio } from "@/components/charts/lib/mining"
const benches = [
  { name: "1240 RL", oreT: 210000, wasteT: 2840000 },
  { name: "1225 RL", oreT: 640000, wasteT: 3120000 },
  { name: "1210 RL", oreT: 1180000, wasteT: 3480000 },
  { name: "1195 RL", oreT: 1640000, wasteT: 3260000 },
  { name: "1180 RL", oreT: 1980000, wasteT: 2740000 },
  { name: "1165 RL", oreT: 2140000, wasteT: 1980000 },
  { name: "1150 RL", oreT: 1860000, wasteT: 1240000 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripping</CardTitle>
        <CardDescription>Waste over ore, bench by bench</CardDescription>
      </CardHeader>
      <CardContent>
        <StrippingRatio benches={benches} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One bench is paid in full, not on average <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Stage 2 pushback
        </div>
      </CardFooter>
    </Card>
  )
}

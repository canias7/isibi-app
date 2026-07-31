import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RequisitionAgeing } from "@/components/charts/lib/recruiting"
const requisitions = [
  { name: "Head of platform", openDays: 142, team: "Engineering", dailyValue: 620, candidatesAtOffer: 1 },
  { name: "Backend engineer ×2", openDays: 61, team: "Engineering", dailyValue: 880 },
  { name: "Account executive", openDays: 96, team: "Commercial", dailyValue: 1400, candidatesAtOffer: 2 },
  { name: "Product designer", openDays: 118, team: "Design", dailyValue: 310 },
  { name: "Finance manager", openDays: 38, team: "Finance", dailyValue: 240 },
  { name: "Support agent ×3", openDays: 22, team: "Operations", dailyValue: 420 },
  { name: "Data analyst", openDays: 74, team: "Data", dailyValue: 180 },
  { name: "Office coordinator", openDays: 51, team: "Operations" },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open requisitions</CardTitle>
        <CardDescription>Sorted by what the vacancy has cost</CardDescription>
      </CardHeader>
      <CardContent>
        <RequisitionAgeing requisitions={requisitions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An ageing list sorted by date is the wrong order <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Today
        </div>
      </CardFooter>
    </Card>
  )
}

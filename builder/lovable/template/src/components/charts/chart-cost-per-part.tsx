import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CostPerPart } from "@/components/charts/lib/additive"
const scenarios = [
  { name: "Full plate, proven", parts: 72, buildHours: 26.4, powderCost: 480, postCostPerPart: 6.2, scrapRate: 0.03 },
  { name: "Full plate, new part", parts: 72, buildHours: 26.4, powderCost: 480, postCostPerPart: 6.2, scrapRate: 0.14 },
  { name: "Half plate, urgent", parts: 34, buildHours: 24.1, powderCost: 260, postCostPerPart: 6.2, scrapRate: 0.05 },
  { name: "Single prototype", parts: 1, buildHours: 9.8, powderCost: 42, postCostPerPart: 14, scrapRate: 0.2 },
  { name: "Tall nest", parts: 96, buildHours: 61.2, powderCost: 640, postCostPerPart: 4.8, scrapRate: 0.06 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost per part</CardTitle>
        <CardDescription>Machine time divided by whatever was on the plate</CardDescription>
      </CardHeader>
      <CardContent>
        <CostPerPart scenarios={scenarios} machineRatePerHour={38} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Quoting by the hour and selling by the part <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Same machine, five nests
        </div>
      </CardFooter>
    </Card>
  )
}

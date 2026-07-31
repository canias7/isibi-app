import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConsignmentMix } from "@/components/charts/lib/auction"
const sources = [
  { name: "House clearance", lots: 1240, hammerTotal: 286000, sellerCommission: 0.15 },
  { name: "Probate and executors", lots: 412, hammerTotal: 494000, sellerCommission: 0.12 },
  { name: "Trade vendors", lots: 986, hammerTotal: 218000, sellerCommission: 0.08 },
  { name: "Private consignors", lots: 186, hammerTotal: 341000, sellerCommission: 0.15 },
  { name: "Insolvency instructions", lots: 641, hammerTotal: 96000, sellerCommission: 0.1 },
  { name: "Charity donations", lots: 294, hammerTotal: 31000, sellerCommission: 0.2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where lots come from</CardTitle>
        <CardDescription>Net of what a lot costs to handle</CardDescription>
      </CardHeader>
      <CardContent>
        <ConsignmentMix sources={sources} costPerLot={22} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Volume is not the same as value <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One year
        </div>
      </CardFooter>
    </Card>
  )
}

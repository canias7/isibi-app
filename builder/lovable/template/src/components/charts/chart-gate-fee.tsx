import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GateFee } from "@/components/charts/lib/waste"
const destinations = [
  { name: "MRF, near", gateFeePerT: -18, haulagePerT: 9, rejectionRate: 0.14, landfillCostPerT: 126 },
  { name: "MRF, far", gateFeePerT: -34, haulagePerT: 26, rejectionRate: 0.04, landfillCostPerT: 126 },
  { name: "Energy from waste", gateFeePerT: 82, haulagePerT: 12 },
  { name: "Landfill", gateFeePerT: 126, haulagePerT: 7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gate fee</CardTitle>
        <CardDescription>The quoted cost against the expected one</CardDescription>
      </CardHeader>
      <CardContent>
        <GateFee destinations={destinations} tonnesPerYear={24000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The cheapest quote is not the cheapest destination <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          24,000 t a year
        </div>
      </CardFooter>
    </Card>
  )
}

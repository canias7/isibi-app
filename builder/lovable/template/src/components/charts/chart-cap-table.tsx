import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CapTable } from "@/components/charts/lib/finance2"
const holders = [
  { name: "Founders", shares: 6_000_000, kind: "common" },
  { name: "Northwind Ventures", shares: 2_400_000, kind: "preferred" },
  { name: "Option pool", shares: 1_200_000, kind: "reserved" },
  { name: "Angels", shares: 300_000, kind: "common" },
  { name: "Advisors", shares: 100_000, kind: "common" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ownership</CardTitle>
        <CardDescription>Shares, and the percentages they imply</CardDescription>
      </CardHeader>
      <CardContent>
        <CapTable holders={holders} pricePerShare={2.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Percentages are computed, never typed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Post Series A
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PatentFamily } from "@/components/charts/lib/patents"
const members = [
  { jurisdiction: "US", status: "granted" as const, filedYear: 2018 },
  { jurisdiction: "EP", status: "granted" as const, filedYear: 2018 },
  { jurisdiction: "CN", status: "pending" as const, filedYear: 2019 },
  { jurisdiction: "JP", status: "refused" as const, filedYear: 2019 },
  { jurisdiction: "KR", status: "granted" as const, filedYear: 2019 },
  { jurisdiction: "AU", status: "abandoned" as const, filedYear: 2019 },
]
const markets = [
  { jurisdiction: "US", revenueShare: 0.38 },
  { jurisdiction: "EP", revenueShare: 0.24 },
  { jurisdiction: "CN", revenueShare: 0.14 },
  { jurisdiction: "JP", revenueShare: 0.09 },
  { jurisdiction: "IN", revenueShare: 0.08 },
  { jurisdiction: "BR", revenueShare: 0.07 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Family coverage</CardTitle>
        <CardDescription>Filings against the markets that earn</CardDescription>
      </CardHeader>
      <CardContent>
        <PatentFamily members={members} markets={markets} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A fifth of revenue has nothing behind it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One family
        </div>
      </CardFooter>
    </Card>
  )
}

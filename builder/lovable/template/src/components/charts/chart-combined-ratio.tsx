import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CombinedRatio } from "@/components/charts/lib/insure"
const lines = [
  { name: "Motor", lossRatio: 0.78, expenseRatio: 0.29 },
  { name: "Household", lossRatio: 0.61, expenseRatio: 0.32 },
  { name: "Liability", lossRatio: 0.72, expenseRatio: 0.24 },
  { name: "Marine", lossRatio: 0.55, expenseRatio: 0.31 },
  { name: "Travel", lossRatio: 0.84, expenseRatio: 0.38 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Combined ratio</CardTitle>
        <CardDescription>Losses plus expenses over premium</CardDescription>
      </CardHeader>
      <CardContent>
        <CombinedRatio lines={lines} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Above 100 the underwriting loses <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By line
        </div>
      </CardFooter>
    </Card>
  )
}

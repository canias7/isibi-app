import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CutOffGrade } from "@/components/charts/lib/mining"
const scenarios = [
  { name: "Budget · $1,900/oz", pricePerUnit: 61.1, recovery: 0.91, miningCostPerT: 2.8, processingCostPerT: 14.2, gaPerT: 3.1, feedGrade: 1.24 },
  { name: "Spot · $2,400/oz", pricePerUnit: 77.2, recovery: 0.91, miningCostPerT: 2.8, processingCostPerT: 14.2, gaPerT: 3.1, feedGrade: 1.24 },
  { name: "Downside · $1,500/oz", pricePerUnit: 48.2, recovery: 0.91, miningCostPerT: 2.8, processingCostPerT: 14.2, gaPerT: 3.1, feedGrade: 1.24 },
  { name: "Budget, hard ore", pricePerUnit: 61.1, recovery: 0.82, miningCostPerT: 3.4, processingCostPerT: 18.6, gaPerT: 3.1, feedGrade: 1.24 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cut-off</CardTitle>
        <CardDescription>Arithmetic, not policy</CardDescription>
      </CardHeader>
      <CardContent>
        <CutOffGrade scenarios={scenarios} unit="g/t" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The gap is ore worth treating and not worth mining for <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four price cases
        </div>
      </CardFooter>
    </Card>
  )
}

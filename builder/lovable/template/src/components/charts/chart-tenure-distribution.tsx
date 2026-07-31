import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TenureDistribution } from "@/components/charts/lib/hr"
const buckets = [
  { range: "<1y", count: 96, upperYears: 1 }, { range: "1–2y", count: 88, upperYears: 2 },
  { range: "2–4y", count: 104, upperYears: 4 }, { range: "4–7y", count: 68, upperYears: 7 },
  { range: "7–10y", count: 34, upperYears: 10 }, { range: "10y+", count: 22, upperYears: 40 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How long people stay</CardTitle>
        <CardDescription>Tenure across the company</CardDescription>
      </CardHeader>
      <CardContent>
        <TenureDistribution buckets={buckets} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The median bucket is drawn solid <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Headcount 412
        </div>
      </CardFooter>
    </Card>
  )
}

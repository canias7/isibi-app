import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DurationGap } from "@/components/charts/lib/finance3"
const buckets = [
  { label: "0–1m", assets: 420, liabilities: 310 },
  { label: "1–3m", assets: 260, liabilities: 340 },
  { label: "3–6m", assets: 180, liabilities: 220 },
  { label: "6–12m", assets: 150, liabilities: 260 },
  { label: "1–3y", assets: 310, liabilities: 190 },
  { label: "3y+", assets: 280, liabilities: 280 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Repricing gap</CardTitle>
        <CardDescription>Assets and liabilities by repricing bucket</CardDescription>
      </CardHeader>
      <CardContent>
        <DurationGap buckets={buckets} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Liability-heavy through the middle buckets <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Balance sheet, £m
        </div>
      </CardFooter>
    </Card>
  )
}

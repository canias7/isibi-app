import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tornado, RangeBar, BumpChart } from "./lib/comparison"

const items = [
  { label: "Staff cost", low: 1800, high: 3900 },
  { label: "Price", low: 2100, high: 3500 },
  { label: "Footfall", low: 2300, high: 3300 },
  { label: "Rent", low: 2500, high: 3100 },
  { label: "Stock", low: 2650, high: 2950 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tornado</CardTitle>
        <CardDescription>What moves profit most.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tornado items={items} base={2800} format={(n) => "£" + n.toLocaleString()} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Staff cost dominates <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

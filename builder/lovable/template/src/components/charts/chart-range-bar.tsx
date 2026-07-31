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
  { label: "Mon", low: 9, high: 17, point: 12 },
  { label: "Tue", low: 9, high: 17, point: 11 },
  { label: "Wed", low: 9, high: 18, point: 15 },
  { label: "Thu", low: 9, high: 19, point: 17 },
  { label: "Fri", low: 8, high: 19, point: 16 },
  { label: "Sat", low: 8, high: 20, point: 13 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Range Bar</CardTitle>
        <CardDescription>Opening hours, with the busiest moment marked.</CardDescription>
      </CardHeader>
      <CardContent>
        <RangeBar items={items} format={(n) => n + ":00"} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday runs longest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

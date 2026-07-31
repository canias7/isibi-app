import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Candlestick, sampleCandles } from "./lib/candlestick"

const candles = sampleCandles(10, 38, 31)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candlestick</CardTitle>
        <CardDescription>Two weeks.</CardDescription>
      </CardHeader>
      <CardContent>
        <Candlestick candles={candles} showLabels bodyWidth={0.7} format={(n) => "£" + n.toFixed(2)} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Closed the fortnight up <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

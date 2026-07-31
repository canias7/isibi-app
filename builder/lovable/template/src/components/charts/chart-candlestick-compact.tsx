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

const candles = sampleCandles(24, 42, 11)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candlestick</CardTitle>
        <CardDescription>Small enough to sit beside a number.</CardDescription>
      </CardHeader>
      <CardContent>
        <Candlestick candles={candles} height={120} showAxis={false} format={(n) => "£" + n.toFixed(2)} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Closed the period up <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

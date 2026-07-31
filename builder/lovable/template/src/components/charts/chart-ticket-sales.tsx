import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TicketSales } from "@/components/charts/lib/events"
let s = 88
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const sales = Array.from({ length: 42 }, (_, d) => {
  const onSaleSpike = d < 3 ? 420 : 0
  const base = 38 + d * 0.9
  return Math.round(onSaleSpike + base * (0.6 + rnd() * 0.8))
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket sales</CardTitle>
        <CardDescription>Pace against capacity and break-even</CardDescription>
      </CardHeader>
      <CardContent>
        <TicketSales sales={sales} capacity={4200} breakEvenTickets={2600} daysToShow={60} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Sales accelerate in the final fortnight <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          60-day on-sale
        </div>
      </CardFooter>
    </Card>
  )
}

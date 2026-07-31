import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SeatingYield } from "@/components/charts/lib/events"
const bands = [
  { name: "Stalls A–F", seats: 420, sold: 412, price: 68 },
  { name: "Stalls G–R", seats: 680, sold: 601, price: 52 },
  { name: "Circle front", seats: 340, sold: 284, price: 58 },
  { name: "Circle rear", seats: 460, sold: 212, price: 34 },
  { name: "Balcony", seats: 300, sold: 96, price: 22 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seating yield</CardTitle>
        <CardDescription>Revenue per seat, not per ticket</CardDescription>
      </CardHeader>
      <CardContent>
        <SeatingYield bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The empty seats are the gap <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One show
        </div>
      </CardFooter>
    </Card>
  )
}

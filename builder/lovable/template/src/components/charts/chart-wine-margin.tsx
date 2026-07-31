import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WineMargin } from "@/components/charts/lib/restaurant"
const wines = [
  { name: "House red", cost: 6.2, list: 26 },
  { name: "Prosecco", cost: 8.1, list: 34 },
  { name: "Riesling", cost: 11.2, list: 42 },
  { name: "Chablis", cost: 14.5, list: 52 },
  { name: "Sancerre", cost: 16.9, list: 56 },
  { name: "Rioja Reserva", cost: 17.4, list: 58 },
  { name: "Champagne NV", cost: 31, list: 96 },
  { name: "Barolo", cost: 38, list: 118 },
  { name: "Amarone", cost: 44, list: 132 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wine list</CardTitle>
        <CardDescription>Bottle cost against list price</CardDescription>
      </CardHeader>
      <CardContent>
        <WineMargin wines={wines} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The multiple falls as the bottle rises <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Nine bins
        </div>
      </CardFooter>
    </Card>
  )
}

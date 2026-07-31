import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PricePartyIndex } from "@/components/charts/lib/econ"
const places = [
  { place: "Switzerland", price: 8.1, currency: "CHF", marketRate: 0.72 },
  { place: "Norway", price: 72, currency: "NOK", marketRate: 8.6 },
  { place: "Japan", price: 480, currency: "JPY", marketRate: 118 },
  { place: "Brazil", price: 22.9, currency: "BRL", marketRate: 4.1 },
  { place: "India", price: 190, currency: "INR", marketRate: 67 },
  { place: "South Africa", price: 39, currency: "ZAR", marketRate: 14.6 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The same basket abroad</CardTitle>
        <CardDescription>Implied rate against the market rate</CardDescription>
      </CardHeader>
      <CardContent>
        <PricePartyIndex base={{ place: "United States", price: 5.6, currency: "USD" }} places={places} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Over- and under-valuation falls out <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One index
        </div>
      </CardFooter>
    </Card>
  )
}

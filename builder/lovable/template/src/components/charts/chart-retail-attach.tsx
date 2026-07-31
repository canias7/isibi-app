import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RetailAttach } from "@/components/charts/lib/salon"
const lines = [
  { name: "Shampoo", unitsSold: 186, price: 14.5, cost: 7.2, servicesInPeriod: 640 },
  { name: "Conditioner", unitsSold: 141, price: 15.9, cost: 7.9, servicesInPeriod: 640 },
  { name: "Heat protector", unitsSold: 98, price: 17.5, cost: 8.4, servicesInPeriod: 640 },
  { name: "Styling cream", unitsSold: 74, price: 21, cost: 9.8, servicesInPeriod: 640 },
  { name: "Colour refresh", unitsSold: 52, price: 26, cost: 15.6, servicesInPeriod: 640 },
  { name: "Detangling brush", unitsSold: 19, price: 32, cost: 24, servicesInPeriod: 640 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retail</CardTitle>
        <CardDescription>The best-paid minute in the salon</CardDescription>
      </CardHeader>
      <CardContent>
        <RetailAttach lines={lines} serviceRatePerChairHour={42} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Margin and attach are different questions <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          640 services
        </div>
      </CardFooter>
    </Card>
  )
}

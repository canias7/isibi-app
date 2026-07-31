import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ServiceMix } from "@/components/charts/lib/salon"
const services = [
  { name: "Cut and finish", bookings: 210, minutes: 45, price: 34 },
  { name: "Blow dry", bookings: 96, minutes: 30, price: 24 },
  { name: "Highlights", bookings: 62, minutes: 195, price: 118, materialCost: 19 },
  { name: "Full head colour", bookings: 48, minutes: 165, price: 96, materialCost: 14 },
  { name: "Root touch-up", bookings: 74, minutes: 75, price: 54, materialCost: 8 },
  { name: "Bond treatment", bookings: 38, minutes: 20, price: 28, materialCost: 6 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service mix</CardTitle>
        <CardDescription>The diary and the till disagree</CardDescription>
      </CardHeader>
      <CardContent>
        <ServiceMix services={services} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          There are only so many chair-hours in a week <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}

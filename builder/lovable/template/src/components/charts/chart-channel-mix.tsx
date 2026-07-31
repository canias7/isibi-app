import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChannelMix } from "@/components/charts/lib/hotel"
const channels = [
  { name: "Brand.com", roomNights: 4210, adr: 176, commission: 0.02, costPerBooking: 3.4 },
  { name: "OTA — large", roomNights: 4900, adr: 168, commission: 0.18 },
  { name: "OTA — small", roomNights: 1120, adr: 159, commission: 0.15 },
  { name: "Corporate", roomNights: 3960, adr: 141, commission: 0.08 },
  { name: "Wholesale", roomNights: 2280, adr: 112, commission: 0.22 },
  { name: "Walk-in", roomNights: 410, adr: 194, commission: 0 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel mix</CardTitle>
        <CardDescription>Volume against the rate actually kept</CardDescription>
      </CardHeader>
      <CardContent>
        <ChannelMix channels={channels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The channel that sells most does not earn most <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last quarter
        </div>
      </CardFooter>
    </Card>
  )
}

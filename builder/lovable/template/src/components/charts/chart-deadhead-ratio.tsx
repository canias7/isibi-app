import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeadheadRatio } from "@/components/charts/lib/taxi"
const shifts = [
  { label: "Fri night, city", paidMiles: 96, deadMiles: 41, fares: 284 },
  { label: "Sat night, city", paidMiles: 108, deadMiles: 38, fares: 331 },
  { label: "Mon day, suburbs", paidMiles: 74, deadMiles: 86, fares: 196 },
  { label: "Tue day, suburbs", paidMiles: 68, deadMiles: 91, fares: 181 },
  { label: "Wed airport runs", paidMiles: 184, deadMiles: 172, fares: 412 },
  { label: "Thu school and hospital", paidMiles: 88, deadMiles: 54, fares: 234 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Empty miles</CardTitle>
        <CardDescription>Paid per mile, worn out per mile</CardDescription>
      </CardHeader>
      <CardContent>
        <DeadheadRatio shifts={shifts} costPerMile={0.41} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The fare card is not the rate <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six shifts
        </div>
      </CardFooter>
    </Card>
  )
}

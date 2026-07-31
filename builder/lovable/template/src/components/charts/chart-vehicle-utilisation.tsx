import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VehicleUtilisation } from "@/components/charts/lib/freight"
const days = [
  { name: "FH12 · trunk", loaded: 402, empty: 48, loading: 55, waiting: 40, idle: 55 },
  { name: "XF14 · regional", loaded: 288, empty: 96, loading: 84, waiting: 92, idle: 40 },
  { name: "FM09 · multidrop", loaded: 196, empty: 44, loading: 168, waiting: 62, idle: 30 },
  { name: "TGX02 · tramping", loaded: 384, empty: 120, loading: 46, waiting: 30, idle: 20 },
  { name: "R450 · store deliveries", loaded: 214, empty: 142, loading: 120, waiting: 134, idle: 30 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle day</CardTitle>
        <CardDescription>Only one part of it is billable</CardDescription>
      </CardHeader>
      <CardContent>
        <VehicleUtilisation days={days} dailyFixedCost={410} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Waiting at somebody else's gate is the largest recoverable item <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five vehicles, one day
        </div>
      </CardFooter>
    </Card>
  )
}

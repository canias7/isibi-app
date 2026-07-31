import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WeightBalance } from "@/components/charts/lib/aviation"
const items = [
  { name: "Basic empty", kg: 42600, armM: 17.2 },
  { name: "Flight crew", kg: 180, armM: 4.1 },
  { name: "Cabin crew", kg: 320, armM: 19.4 },
  { name: "Passengers, fwd", kg: 4200, armM: 13.8 },
  { name: "Passengers, aft", kg: 4650, armM: 22.6 },
  { name: "Hold 1", kg: 1800, armM: 11.2 },
  { name: "Hold 4", kg: 1350, armM: 26.4 },
  { name: "Fuel", kg: 9400, armM: 17.6 },
]
const envelope = [
  { cgM: 16.6, kg: 44000 }, { cgM: 18.6, kg: 44000 },
  { cgM: 18.9, kg: 58000 }, { cgM: 18.4, kg: 66000 },
  { cgM: 17.3, kg: 66000 }, { cgM: 16.9, kg: 52000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight and balance</CardTitle>
        <CardDescription>The centre of gravity computed from the moments</CardDescription>
      </CardHeader>
      <CardContent>
        <WeightBalance items={items} envelope={envelope} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The load is inside the envelope <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Loadsheet check
        </div>
      </CardFooter>
    </Card>
  )
}

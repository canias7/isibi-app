import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DoughTemp } from "@/components/charts/lib/bakery"
const days = [
  { label: "Mon", roomC: 19, flourC: 18, prefermentC: 22, achievedC: 25.2 },
  { label: "Tue", roomC: 21, flourC: 20, prefermentC: 23, achievedC: 25.4 },
  { label: "Wed", roomC: 24, flourC: 23, prefermentC: 24, achievedC: 25.9 },
  { label: "Thu", roomC: 27, flourC: 26, prefermentC: 26, achievedC: 26.4 },
  { label: "Fri", roomC: 29, flourC: 27, prefermentC: 27, achievedC: 26.8 },
  { label: "Sat", roomC: 22, flourC: 21, prefermentC: 23, achievedC: 25.3 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Water temperature</CardTitle>
        <CardDescription>Derived from the day, not the recipe</CardDescription>
      </CardHeader>
      <CardContent>
        <DoughTemp days={days} targetC={25} frictionC={4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A missed target is the friction factor asking to be re-measured <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Target 25°C
        </div>
      </CardFooter>
    </Card>
  )
}

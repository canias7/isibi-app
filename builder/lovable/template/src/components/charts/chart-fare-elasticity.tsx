import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FareElasticity } from "@/components/charts/lib/transit2"
const points = Array.from({ length: 13 }, (_, i) => {
  const fare = 1 + i * 0.25
  return { fare, riders: Math.round(120000 * Math.pow(fare, -0.62)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fare response</CardTitle>
        <CardDescription>Riders and revenue against price</CardDescription>
      </CardHeader>
      <CardContent>
        <FareElasticity points={points} currentFare={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Revenue peaks well above the current fare <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Single-journey adult
        </div>
      </CardFooter>
    </Card>
  )
}

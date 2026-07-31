import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GearSelectivity } from "@/components/charts/lib/fisheries"
const gears = [
  { name: "80 mm diamond", points: [
    { cm: 18, retained: 0.06 }, { cm: 22, retained: 0.18 }, { cm: 26, retained: 0.41 },
    { cm: 30, retained: 0.68 }, { cm: 34, retained: 0.86 }, { cm: 38, retained: 0.95 }, { cm: 42, retained: 0.99 }] },
  { name: "100 mm diamond", points: [
    { cm: 18, retained: 0.01 }, { cm: 22, retained: 0.05 }, { cm: 26, retained: 0.17 },
    { cm: 30, retained: 0.44 }, { cm: 34, retained: 0.74 }, { cm: 38, retained: 0.91 }, { cm: 42, retained: 0.98 }] },
  { name: "90 mm square", points: [
    { cm: 18, retained: 0.02 }, { cm: 22, retained: 0.04 }, { cm: 26, retained: 0.09 },
    { cm: 30, retained: 0.51 }, { cm: 34, retained: 0.92 }, { cm: 38, retained: 0.99 }, { cm: 42, retained: 1 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Selectivity</CardTitle>
        <CardDescription>L50 fitted from a paired-gear trial</CardDescription>
      </CardHeader>
      <CardContent>
        <GearSelectivity gears={gears} minSizeCm={30} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A flat curve does not select, whatever its L50 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three cod-ends
        </div>
      </CardFooter>
    </Card>
  )
}

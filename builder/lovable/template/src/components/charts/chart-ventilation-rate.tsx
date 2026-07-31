import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VentilationRate } from "@/components/charts/lib/hvac"
const rooms = [
  { name: "Board room", people: 14, supplyLs: 84 },
  { name: "Meeting 1", people: 8, supplyLs: 42 },
  { name: "Meeting 2", people: 6, supplyLs: 68 },
  { name: "Open plan", people: 62, supplyLs: 720 },
  { name: "Training room", people: 24, supplyLs: 168 },
  { name: "Quiet booth", people: 1, supplyLs: 6 },
  { name: "Canteen", people: 40, supplyLs: 560 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventilation</CardTitle>
        <CardDescription>The CO₂ a supply rate produces</CardDescription>
      </CardHeader>
      <CardContent>
        <VentilationRate rooms={rooms} standardLsPerson={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Stuffy is a design decision, not a mystery <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          10 l/s per person
        </div>
      </CardFooter>
    </Card>
  )
}

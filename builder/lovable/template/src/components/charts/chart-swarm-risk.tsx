import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwarmRisk } from "@/components/charts/lib/apiary"
const inspections = [
  { date: "22 Apr", queenCells: 0, framesOfBrood: 5, framesSpare: 6, drones: false },
  { date: "29 Apr", queenCells: 0, framesOfBrood: 7, framesSpare: 4, drones: true },
  { date: "6 May", queenCells: 1, framesOfBrood: 9, framesSpare: 2, drones: true },
  { date: "13 May", queenCells: 4, framesOfBrood: 10, framesSpare: 1, drones: true },
  { date: "20 May", queenCells: 8, framesOfBrood: 10, framesSpare: 0, drones: true },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Swarm signals</CardTitle>
        <CardDescription>Three signs, scored together</CardDescription>
      </CardHeader>
      <CardContent>
        <SwarmRisk inspections={inspections} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every inspection after the line is late <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Hive 3, May
        </div>
      </CardFooter>
    </Card>
  )
}

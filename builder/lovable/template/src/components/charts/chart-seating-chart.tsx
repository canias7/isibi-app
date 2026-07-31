import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwotGrid, OkrTree, MetroMap, SeatingChart, ResourceHistogram } from "./lib/org2"

const tables = [
  { label: "W1", x: 22, y: 22, seats: [true, true, true, true] },
  { label: "W2", x: 55, y: 20, seats: [true, true, false, true] },
  { label: "M1", x: 80, y: 35, seats: [false, false, true, false] },
  { label: "M2", x: 35, y: 52, seats: [true, false, false, false, true, false] },
  { label: "B1", x: 68, y: 64, seats: [false, false, false, false] },
  { label: "B2", x: 28, y: 82, seats: [true, true, false, false] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seating Chart</CardTitle>
        <CardDescription>Tables and chairs, occupancy at a glance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SeatingChart tables={tables} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The window tables fill first <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

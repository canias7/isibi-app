import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BoardingAlighting } from "@/components/charts/lib/transit2"
const stops = [
  { name: "Depot", on: 4, off: 0 }, { name: "Mill Ln", on: 11, off: 1 },
  { name: "Oakfield", on: 18, off: 2 }, { name: "St Mary's", on: 22, off: 3 },
  { name: "Parkway", on: 14, off: 4 }, { name: "Hospital", on: 9, off: 12 },
  { name: "College", on: 21, off: 6 }, { name: "Bridge St", on: 16, off: 5 },
  { name: "Market", on: 6, off: 24 }, { name: "Station", on: 2, off: 31 },
  { name: "Quay", on: 1, off: 18 }, { name: "Terminus", on: 0, off: 18 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Route loading</CardTitle>
        <CardDescription>Ons, offs and the running load</CardDescription>
      </CardHeader>
      <CardContent>
        <BoardingAlighting stops={stops} capacity={62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The bus is over seated capacity by stop 8 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Inbound, 08:10 departure
        </div>
      </CardFooter>
    </Card>
  )
}

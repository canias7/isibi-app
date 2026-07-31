import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CourtesyFleet } from "@/components/charts/lib/garage"
const days = [
  { label: "M", requested: 5 }, { label: "T", requested: 4 }, { label: "W", requested: 7 },
  { label: "T", requested: 6 }, { label: "F", requested: 8 }, { label: "M", requested: 3 },
  { label: "T", requested: 5 }, { label: "W", requested: 4 }, { label: "T", requested: 6 },
  { label: "F", requested: 9 }, { label: "M", requested: 2 }, { label: "T", requested: 4 },
  { label: "W", requested: 5 }, { label: "T", requested: 7 }, { label: "F", requested: 6 },
  { label: "M", requested: 3 }, { label: "T", requested: 4 }, { label: "W", requested: 6 },
  { label: "T", requested: 5 }, { label: "F", requested: 8 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Courtesy cars</CardTitle>
        <CardDescription>The jobs that waited</CardDescription>
      </CardHeader>
      <CardContent>
        <CourtesyFleet days={days} fleetSize={4} jobValue={180} carCostPerDay={22} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A delayed job is not a lost job on any report <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four weeks
        </div>
      </CardFooter>
    </Card>
  )
}

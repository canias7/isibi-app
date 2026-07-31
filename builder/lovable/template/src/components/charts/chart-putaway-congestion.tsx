import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PutawayCongestion } from "@/components/charts/lib/warehouse"
const aisles = [
  { name: "Aisle 1", capacity: 2 },
  { name: "Aisle 2", capacity: 1 },
  { name: "Aisle 3", capacity: 2 },
  { name: "Aisle 4", capacity: 1 },
  { name: "Aisle 5", capacity: 3 },
  { name: "Aisle 6", capacity: 2 },
]
const hours = ["06", "07", "08", "09", "10", "11", "12", "13"]
const moves = [
  [4, 8, 11, 9, 6, 4, 3, 5],
  [3, 6, 9, 7, 5, 3, 2, 4],
  [6, 12, 14, 11, 8, 6, 4, 7],
  [2, 5, 8, 6, 4, 3, 2, 3],
  [8, 16, 21, 18, 12, 9, 6, 10],
  [5, 9, 12, 10, 7, 5, 3, 6],
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aisle congestion</CardTitle>
        <CardDescription>Moves against what the aisle can take</CardDescription>
      </CardHeader>
      <CardContent>
        <PutawayCongestion aisles={aisles} hours={hours} moves={moves} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A narrow aisle jams on half the traffic <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One shift
        </div>
      </CardFooter>
    </Card>
  )
}

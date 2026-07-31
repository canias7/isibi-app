import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Malapportionment } from "@/components/charts/lib/elections"
const districts = [
  { name: "Northern", electors: 412000, seats: 9 },
  { name: "Central", electors: 688000, seats: 11 },
  { name: "Eastern", electors: 521000, seats: 10 },
  { name: "Coastal", electors: 274000, seats: 7 },
  { name: "Western", electors: 596000, seats: 11 },
  { name: "Southern", electors: 448000, seats: 9 },
  { name: "Islands", electors: 96000, seats: 3 },
  { name: "Capital", electors: 812000, seats: 13 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voters per seat</CardTitle>
        <CardDescription>Districts against the national quota</CardDescription>
      </CardHeader>
      <CardContent>
        <Malapportionment districts={districts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A vote is worth 1.95 votes elsewhere <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight districts
        </div>
      </CardFooter>
    </Card>
  )
}

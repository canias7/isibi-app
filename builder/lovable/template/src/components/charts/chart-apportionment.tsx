import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Apportionment } from "@/components/charts/lib/civic"
const regions = [
  { name: "Northern", population: 2_410_000 },
  { name: "Coastal", population: 1_180_000 },
  { name: "Central", population: 3_960_000 },
  { name: "Western", population: 740_000 },
  { name: "Islands", population: 205_000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seats by population</CardTitle>
        <CardDescription>Exact quota against whole seats</CardDescription>
      </CardHeader>
      <CardContent>
        <Apportionment regions={regions} seats={40} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The gap between them is the whole subject <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Highest averages
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LengthOfStay } from "@/components/charts/lib/hotel"
const arrivals = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const nights = [1, 2, 3, 4, 5]
const counts = [
  [18, 22, 9, 3, 1],
  [24, 31, 12, 4, 2],
  [29, 38, 16, 5, 2],
  [34, 46, 22, 8, 3],
  [41, 88, 26, 6, 2],
  [52, 34, 11, 3, 1],
  [21, 12, 4, 1, 0],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Length of stay</CardTitle>
        <CardDescription>Which arrivals occupy the night worth selling</CardDescription>
      </CardHeader>
      <CardContent>
        <LengthOfStay arrivals={arrivals} nights={nights} counts={counts} peakNights={["Sat"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A minimum-stay rule turns away two in five of them <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Saturday is the peak
        </div>
      </CardFooter>
    </Card>
  )
}

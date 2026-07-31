import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BayUtilisation } from "@/components/charts/lib/garage"
const hours = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"]
const bays = [
  { name: "MOT bay", booked: [1, 1, 1, 1, 0.5, 0, 1, 1, 1, 0.5], actual: [1, 1, 1, 1, 0.6, 0, 1, 1, 1, 0.4] },
  { name: "Ramp 1", booked: [1, 1, 1, 0.5, 0, 0, 1, 1, 0.5, 0], actual: [1, 1, 1, 1, 0.4, 0, 1, 1, 1, 0.7] },
  { name: "Ramp 2", booked: [0.5, 1, 1, 1, 0, 0, 0.5, 0.5, 0, 0], actual: [0.3, 0.8, 1, 0.9, 0, 0, 0.4, 0.5, 0, 0] },
  { name: "Tyre bay", booked: [0, 0.5, 0.5, 0.5, 0, 0, 1, 1, 1, 0.5], actual: [0, 0.4, 0.6, 0.5, 0, 0, 1, 1, 1, 0.8] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bays</CardTitle>
        <CardDescription>Booked against actually worked</CardDescription>
      </CardHeader>
      <CardContent>
        <BayUtilisation bays={bays} hours={hours} labourRate={62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The overrun shows; the pushed job never does <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Wednesday
        </div>
      </CardFooter>
    </Card>
  )
}

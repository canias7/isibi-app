import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlantSequence } from "@/components/charts/lib/hvac"
const hours = ["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18"]
const outsideC = [7, 8, 10, 12, 14, 16, 17, 18, 18, 17, 15, 12, 10]
const plant = [
  { name: "Boiler", mode: "heat" as const, on: [true, true, true, true, true, false, false, false, false, false, true, true, true] },
  { name: "Chiller", mode: "cool" as const, on: [false, false, false, true, true, true, true, true, true, true, true, false, false] },
  { name: "Reheat, south", mode: "heat" as const, on: [true, true, true, true, true, true, true, true, false, false, true, true, true] },
  { name: "AHU fans", mode: "other" as const, on: [true, true, true, true, true, true, true, true, true, true, true, true, false] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plant sequence</CardTitle>
        <CardDescription>Heating and cooling at the same hour</CardDescription>
      </CardHeader>
      <CardContent>
        <PlantSequence hours={hours} outsideC={outsideC} plant={plant} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Invisible on every individual trend <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One shoulder-season day
        </div>
      </CardFooter>
    </Card>
  )
}

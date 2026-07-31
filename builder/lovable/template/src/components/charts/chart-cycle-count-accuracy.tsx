import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CycleCountAccuracy } from "@/components/charts/lib/warehouse"
const counts = [
  { zone: "Pick face A", linesCounted: 1240, over: 18, under: 22, unitsOver: 96, unitsUnder: 104 },
  { zone: "Pick face B", linesCounted: 980, over: 41, under: 39, unitsOver: 212, unitsUnder: 206 },
  { zone: "Bulk racking", linesCounted: 640, over: 6, under: 9, unitsOver: 84, unitsUnder: 120 },
  { zone: "Returns", linesCounted: 310, over: 24, under: 31, unitsOver: 61, unitsUnder: 88 },
  { zone: "Cold store", linesCounted: 420, over: 4, under: 5, unitsOver: 22, unitsUnder: 26 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Count accuracy</CardTitle>
        <CardDescription>Absolute, not net</CardDescription>
      </CardHeader>
      <CardContent>
        <CycleCountAccuracy counts={counts} target={0.97} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two mistakes cancelling look like no problem at all <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last quarter
        </div>
      </CardFooter>
    </Card>
  )
}

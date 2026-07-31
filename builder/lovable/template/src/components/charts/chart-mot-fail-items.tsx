import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MotFailItems } from "@/components/charts/lib/garage"
const items = [
  { name: "Brake pads and discs", failures: 61, wasAdvisory: 44, meanRepair: 218 },
  { name: "Tyres below limit", failures: 78, wasAdvisory: 59, meanRepair: 164 },
  { name: "Suspension, worn bush", failures: 34, wasAdvisory: 21, meanRepair: 186 },
  { name: "Lamps and bulbs", failures: 52, wasAdvisory: 4, meanRepair: 28 },
  { name: "Corrosion, structural", failures: 12, wasAdvisory: 9, meanRepair: 640 },
  { name: "Exhaust emissions", failures: 27, wasAdvisory: 3, meanRepair: 142 },
  { name: "Wipers and washers", failures: 19, wasAdvisory: 2, meanRepair: 34 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MOT failures</CardTitle>
        <CardDescription>Which ones were advised last year</CardDescription>
      </CardHeader>
      <CardContent>
        <MotFailItems items={items} testsInPeriod={480} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A conversation that already happened <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          480 tests
        </div>
      </CardFooter>
    </Card>
  )
}

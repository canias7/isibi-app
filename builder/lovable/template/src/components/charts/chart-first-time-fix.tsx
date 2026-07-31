import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FirstTimeFix } from "@/components/charts/lib/fieldservice"
const categories = [
  { name: "Boiler, no heat", jobs: 412, firstTimeFixed: 331, meanRevisitHours: 1.6 },
  { name: "Boiler, no hot water", jobs: 286, firstTimeFixed: 241, meanRevisitHours: 1.4 },
  { name: "Controls and thermostat", jobs: 148, firstTimeFixed: 132, meanRevisitHours: 0.9 },
  { name: "Leak, wet trace", jobs: 194, firstTimeFixed: 108, meanRevisitHours: 2.2 },
  { name: "Unvented cylinder", jobs: 61, firstTimeFixed: 34, meanRevisitHours: 2.8 },
  { name: "Annual service", jobs: 528, firstTimeFixed: 501, meanRevisitHours: 0.8 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>First-time fix</CardTitle>
        <CardDescription>What the second visit really costs</CardDescription>
      </CardHeader>
      <CardContent>
        <FirstTimeFix categories={categories} travelCost={26} engineerCostPerHour={38} displacedJobValue={140} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The displaced job is the part nothing records <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TreatmentPlanValue } from "@/components/charts/lib/dentistry"
const categories = [
  { name: "Crowns and bridges", planned: 48200, accepted: 27400, completed: 21100 },
  { name: "Implants", planned: 61000, accepted: 22000, completed: 12400 },
  { name: "Orthodontics", planned: 38400, accepted: 24600, completed: 23100 },
  { name: "Periodontal therapy", planned: 21800, accepted: 18200, completed: 11400 },
  { name: "Restorative", planned: 26400, accepted: 24100, completed: 23200 },
  { name: "Whitening", planned: 9600, accepted: 6100, completed: 5800 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Treatment plans</CardTitle>
        <CardDescription>Planned, accepted, completed</CardDescription>
      </CardHeader>
      <CardContent>
        <TreatmentPlanValue categories={categories} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A conversation and a diary need different fixes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last quarter
        </div>
      </CardFooter>
    </Card>
  )
}

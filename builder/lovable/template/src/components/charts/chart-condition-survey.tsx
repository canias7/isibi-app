import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConditionSurvey } from "@/components/charts/lib/museum"
const objects = [
  { name: "Altarpiece panel", condition: 2, significance: 5, treatmentHours: 310 },
  { name: "Roman glass, 12", condition: 2, significance: 3, treatmentHours: 22 },
  { name: "Chintz hanging", condition: 1, significance: 4, treatmentHours: 96 },
  { name: "Sampler, 1782", condition: 3, significance: 4, treatmentHours: 34 },
  { name: "Bronze figure", condition: 4, significance: 5, treatmentHours: 18 },
  { name: "Wax seal matrix", condition: 2, significance: 2, treatmentHours: 11 },
  { name: "Oak coffer", condition: 3, significance: 3, treatmentHours: 62 },
  { name: "Album, 40 prints", condition: 2, significance: 4, treatmentHours: 78 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Condition survey</CardTitle>
        <CardDescription>Priority per hour, not per object</CardDescription>
      </CardHeader>
      <CardContent>
        <ConditionSurvey objects={objects} budgetHours={400} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three quick jobs beat one enormous one <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          400-hour budget
        </div>
      </CardFooter>
    </Card>
  )
}

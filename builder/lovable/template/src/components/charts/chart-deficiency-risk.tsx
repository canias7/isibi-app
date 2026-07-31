import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeficiencyRisk } from "@/components/charts/lib/nutrition"
const nutrients = [
  { label: "Iron", meanIntake: 12.6, sdIntake: 4.4, requirement: 11.4, unit: "mg" },
  { label: "Calcium", meanIntake: 780, sdIntake: 260, requirement: 750, unit: "mg" },
  { label: "Vitamin D", meanIntake: 4.1, sdIntake: 2.6, requirement: 10, unit: "µg" },
  { label: "Folate", meanIntake: 246, sdIntake: 78, requirement: 200, unit: "µg" },
  { label: "Vitamin C", meanIntake: 88, sdIntake: 42, requirement: 40, unit: "mg" },
  { label: "Magnesium", meanIntake: 264, sdIntake: 74, requirement: 265, unit: "mg" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prevalence of inadequacy</CardTitle>
        <CardDescription>Computed from the distribution, not the mean</CardDescription>
      </CardHeader>
      <CardContent>
        <DeficiencyRisk nutrients={nutrients} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An adequate mean can hide a fifth of the group <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Adult women
        </div>
      </CardFooter>
    </Card>
  )
}

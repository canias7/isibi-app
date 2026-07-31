import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VaccineCoverage } from "@/components/charts/lib/med2"
const cohorts = [
  { label: "0–4", covered: 0.94 },
  { label: "5–9", covered: 0.96 },
  { label: "10–14", covered: 0.91 },
  { label: "15–19", covered: 0.88 },
  { label: "20–29", covered: 0.83 },
  { label: "30–39", covered: 0.9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage by cohort</CardTitle>
        <CardDescription>Against the herd-immunity threshold</CardDescription>
      </CardHeader>
      <CardContent>
        <VaccineCoverage cohorts={cohorts} r0={14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The threshold is 1 − 1/R₀, not a round number <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Measles, R₀ 14
        </div>
      </CardFooter>
    </Card>
  )
}

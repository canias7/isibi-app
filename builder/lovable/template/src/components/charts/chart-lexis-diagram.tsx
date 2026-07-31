import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LexisDiagram } from "@/components/charts/lib/econ"
const cohorts = Array.from({ length: 10 }, (_, i) => 1930 + i * 10)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohorts through time</CardTitle>
        <CardDescription>Age against calendar year</CardDescription>
      </CardHeader>
      <CardContent>
        <LexisDiagram
          cohorts={cohorts}
          fromYear={1930}
          toYear={2020}
          maxAge={90}
          events={[{ year: 1945, label: "war ends" }, { year: 2008, label: "crisis" }]}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Each diagonal is one birth cohort <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1930 to 2020
        </div>
      </CardFooter>
    </Card>
  )
}

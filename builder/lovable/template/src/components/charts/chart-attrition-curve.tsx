import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AttritionCurve } from "@/components/charts/lib/hr"
const cohorts = [
  { name: "2021", survival: [1, 0.72, 0.61, 0.55, 0.51] },
  { name: "2022", survival: [1, 0.84, 0.74, 0.69] },
  { name: "2023", survival: [1, 0.91, 0.83] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who stays</CardTitle>
        <CardDescription>Survival by tenure</CardDescription>
      </CardHeader>
      <CardContent>
        <AttritionCurve cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The first year is a hiring problem <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three cohorts
        </div>
      </CardFooter>
    </Card>
  )
}

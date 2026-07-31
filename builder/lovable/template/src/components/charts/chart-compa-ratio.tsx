import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CompaRatio } from "@/components/charts/lib/hr"
const people = [
  { name: "Adeyemi", salary: 52000, bandMid: 58000, yearsInRole: 5 },
  { name: "Brandt", salary: 61000, bandMid: 58000, yearsInRole: 4 },
  { name: "Costa", salary: 47000, bandMid: 58000, yearsInRole: 1 },
  { name: "Dlamini", salary: 66000, bandMid: 58000, yearsInRole: 7 },
  { name: "Erikson", salary: 50500, bandMid: 58000, yearsInRole: 4 },
  { name: "Farouk", salary: 58500, bandMid: 58000, yearsInRole: 2 },
  { name: "Gupta", salary: 72000, bandMid: 58000, yearsInRole: 9 },
  { name: "Haugen", salary: 44000, bandMid: 58000, yearsInRole: 0.5 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay against the midpoint</CardTitle>
        <CardDescription>With tenure behind it</CardDescription>
      </CardHeader>
      <CardContent>
        <CompaRatio people={people} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Low is only a problem with years attached <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One team
        </div>
      </CardFooter>
    </Card>
  )
}

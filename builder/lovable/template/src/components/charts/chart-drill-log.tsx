import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DrillLog } from "@/components/charts/lib/mining"
const holes = [
  { name: "RC-104", intervals: [
    { fromM: 0, toM: 24, grade: 0.08 }, { fromM: 24, toM: 38, grade: 0.31 }, { fromM: 38, toM: 44, grade: 1.84 },
    { fromM: 44, toM: 52, grade: 3.42 }, { fromM: 52, toM: 58, grade: 2.16 }, { fromM: 58, toM: 74, grade: 0.22 }] },
  { name: "RC-105", intervals: [
    { fromM: 0, toM: 30, grade: 0.11 }, { fromM: 30, toM: 46, grade: 0.44 }, { fromM: 46, toM: 56, grade: 1.12 },
    { fromM: 56, toM: 62, grade: 0.61 }, { fromM: 62, toM: 74, grade: 0.14 }] },
  { name: "RC-106", intervals: [
    { fromM: 0, toM: 18, grade: 0.06 }, { fromM: 18, toM: 40, grade: 0.19 }, { fromM: 40, toM: 43, grade: 6.88 },
    { fromM: 43, toM: 48, grade: 4.12 }, { fromM: 48, toM: 74, grade: 0.28 }] },
  { name: "RC-107", intervals: [
    { fromM: 0, toM: 26, grade: 0.09 }, { fromM: 26, toM: 52, grade: 0.24 }, { fromM: 52, toM: 74, grade: 0.17 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drill intersections</CardTitle>
        <CardDescription>The composite, length-weighted</CardDescription>
      </CardHeader>
      <CardContent>
        <DrillLog holes={holes} cutoff={0.5} unit="g/t" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A mean of interval grades over-weights the short ones <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four holes, RC
        </div>
      </CardFooter>
    </Card>
  )
}

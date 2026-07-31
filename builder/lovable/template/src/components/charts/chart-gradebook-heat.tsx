import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GradebookHeat } from "@/components/charts/lib/edu"
const students = ["Adeyemi", "Brandt", "Costa", "Dlamini", "Erikson", "Farouk", "Gupta", "Haugen"]
const assessments = ["Quiz 1", "Essay", "Quiz 2", "Practical", "Mock", "Project"]
let s = 13
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const marks = students.map((_, si) =>
  assessments.map((_, ai) => {
    if (si === 3 && ai === 4) return null
    const base = 0.44 + si * 0.055 + (ai === 3 ? -0.24 : ai * 0.02)
    return Number(Math.max(0.05, Math.min(0.99, base + (r() - 0.5) * 0.16)).toFixed(2))
  }),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marks by student and task</CardTitle>
        <CardDescription>Means on both edges</CardDescription>
      </CardHeader>
      <CardContent>
        <GradebookHeat students={students} assessments={assessments} marks={marks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A low column is an assessment finding <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One class
        </div>
      </CardFooter>
    </Card>
  )
}

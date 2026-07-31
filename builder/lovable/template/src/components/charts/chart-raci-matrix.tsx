import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Yamazumi, TaktTime, Fishbone, RaciMatrix, SkillsMatrix, RotaChart, IncidentTimeline, DefectConcentration } from "./lib/lean"

const tasks = ["Rota", "Stock order", "Marketing", "Payroll", "Reviews"]
const people = ["Ada", "Mo", "Sam", "Rae"]
const assignments = [
  ["A", "R", "C", "I"],
  ["C", "A", "R", "I"],
  ["R", "I", "A", "C"],
  ["A", "C", "I", "R"],
  ["I", "R", "C", "A"],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RACI Matrix</CardTitle>
        <CardDescription>Who is responsible, accountable, consulted, informed.</CardDescription>
      </CardHeader>
      <CardContent>
        <RaciMatrix tasks={tasks} people={people} assignments={assignments} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every task has exactly one owner <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

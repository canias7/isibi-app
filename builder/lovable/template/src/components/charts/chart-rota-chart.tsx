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

const people = ["Ada", "Mo", "Sam", "Rae"]
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const shifts = [
  { person: "Ada", day: 0, from: 9, to: 17 }, { person: "Ada", day: 1, from: 9, to: 17 },
  { person: "Ada", day: 4, from: 9, to: 19 }, { person: "Ada", day: 5, from: 8, to: 16 },
  { person: "Mo", day: 1, from: 12, to: 20 }, { person: "Mo", day: 2, from: 9, to: 17 },
  { person: "Mo", day: 3, from: 9, to: 17 }, { person: "Mo", day: 5, from: 12, to: 20 },
  { person: "Sam", day: 0, from: 12, to: 20 }, { person: "Sam", day: 3, from: 12, to: 20 },
  { person: "Sam", day: 4, from: 12, to: 20 }, { person: "Sam", day: 6, from: 10, to: 14 },
  { person: "Rae", day: 2, from: 12, to: 20 }, { person: "Rae", day: 5, from: 9, to: 18 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rota</CardTitle>
        <CardDescription>Who is on, when.</CardDescription>
      </CardHeader>
      <CardContent>
        <RotaChart people={people} days={days} shifts={shifts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nobody covers Sunday afternoon <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

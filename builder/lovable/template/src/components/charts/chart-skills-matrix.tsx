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

const people = ["Ada", "Mo", "Sam", "Rae", "Kit"]
const skills = ["Cutting", "Colour", "Beard", "Till", "Training"]
const levels = [
  [4, 4, 3, 4, 4],
  [4, 1, 4, 3, 2],
  [3, 0, 3, 4, 1],
  [4, 2, 2, 3, 3],
  [2, 0, 1, 4, 1],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills Matrix</CardTitle>
        <CardDescription>Competence per person, per skill.</CardDescription>
      </CardHeader>
      <CardContent>
        <SkillsMatrix people={people} skills={skills} levels={levels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour is covered by one person only <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

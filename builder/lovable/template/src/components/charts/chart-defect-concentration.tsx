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

const grid = [
  [0, 1, 0, 0],
  [2, 3, 1, 0],
  [1, 2, 2, 1],
  [4, 9, 7, 3],
  [1, 2, 1, 0],
]
const regions = [{ label: "header", row: 0, col: 0 }, { label: "form", row: 3, col: 0 }]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defect Concentration</CardTitle>
        <CardDescription>Where on the page problems cluster.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <DefectConcentration grid={grid} regions={regions} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The form is where it breaks <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

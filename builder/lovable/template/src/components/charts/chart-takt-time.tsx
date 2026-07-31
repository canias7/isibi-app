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

const cycles = [280, 310, 295, 340, 288, 302, 355, 291, 276, 318, 299, 362, 284, 305, 293, 348, 287, 296, 331, 279]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Takt Time</CardTitle>
        <CardDescription>Cycle time per unit against demand.</CardDescription>
      </CardHeader>
      <CardContent>
        <TaktTime cycles={cycles} takt={300} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Seven of twenty ran over <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

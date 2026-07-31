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

const categories = [
  { label: "People", causes: ["Training", "Rota gaps"] },
  { label: "Process", causes: ["No reminder", "Manual entry"] },
  { label: "Tools", causes: ["Slow till", "Old tablet"] },
  { label: "Supplies", causes: ["Late stock"] },
  { label: "Place", causes: ["No parking"] },
  { label: "Measure", causes: ["No tracking"] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fishbone</CardTitle>
        <CardDescription>Cause and effect, by category.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Fishbone problem="Late starts" categories={categories} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Six categories, one problem <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

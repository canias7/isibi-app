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

const stations = [
  { label: "Wash", tasks: [{ label: "Prep", seconds: 40 }, { label: "Wash", seconds: 120 }, { label: "Walk", seconds: 25, valueAdd: false }] },
  { label: "Cut", tasks: [{ label: "Consult", seconds: 60 }, { label: "Cut", seconds: 240 }, { label: "Tidy", seconds: 35, valueAdd: false }] },
  { label: "Finish", tasks: [{ label: "Style", seconds: 180 }, { label: "Product", seconds: 90 }, { label: "Wait", seconds: 70, valueAdd: false }] },
  { label: "Pay", tasks: [{ label: "Till", seconds: 70 }, { label: "Rebook", seconds: 60 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yamazumi</CardTitle>
        <CardDescription>Work content per station against takt.</CardDescription>
      </CardHeader>
      <CardContent>
        <Yamazumi stations={stations} takt={300} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Station 3 sets the pace <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

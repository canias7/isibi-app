import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LandfillDiversion } from "@/components/charts/lib/waste"
const years = [
  { label: "2020", recycled: 22100, composted: 15400, energyRecovery: 18200, landfill: 26800 },
  { label: "2021", recycled: 23400, composted: 15900, energyRecovery: 21600, landfill: 22100 },
  { label: "2022", recycled: 23900, composted: 16100, energyRecovery: 26400, landfill: 17200 },
  { label: "2023", recycled: 24200, composted: 16300, energyRecovery: 30100, landfill: 13400 },
  { label: "2024", recycled: 24600, composted: 16400, energyRecovery: 33200, landfill: 10100 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Diversion</CardTitle>
        <CardDescription>Burning it counts as diversion, not as recycling</CardDescription>
      </CardHeader>
      <CardContent>
        <LandfillDiversion years={years} target={0.65} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One headline hides the distinction <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          65% target
        </div>
      </CardFooter>
    </Card>
  )
}

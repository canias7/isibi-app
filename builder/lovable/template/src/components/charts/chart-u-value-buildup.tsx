import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UValueBuildup } from "@/components/charts/lib/building"
const layers = [
  { name: "Plasterboard", mm: 12.5, lambda: 0.21 },
  { name: "Dense blockwork", mm: 100, lambda: 1.13 },
  { name: "PIR insulation", mm: 100, lambda: 0.022 },
  { name: "Cavity", mm: 50, resistance: 0.18 },
  { name: "Facing brick", mm: 102, lambda: 0.77 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wall build-up</CardTitle>
        <CardDescription>U-value summed from the layer resistances</CardDescription>
      </CardHeader>
      <CardContent>
        <UValueBuildup layers={layers} targetU={0.18} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Where the insulation sits decides the dew point <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cavity wall
        </div>
      </CardFooter>
    </Card>
  )
}

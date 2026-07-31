import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DuctStatic } from "@/components/charts/lib/hvac"
const items = [
  { name: "Supply ductwork", cleanPa: 210, fixed: true },
  { name: "Return ductwork", cleanPa: 120, fixed: true },
  { name: "Panel filter G4", cleanPa: 45, dirtyPa: 180 },
  { name: "Bag filter F7", cleanPa: 90, dirtyPa: 250 },
  { name: "Cooling coil", cleanPa: 130, dirtyPa: 165 },
  { name: "Heating coil", cleanPa: 55, fixed: true },
  { name: "Attenuator", cleanPa: 35, fixed: true },
  { name: "Terminals and grilles", cleanPa: 80, fixed: true },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressure budget</CardTitle>
        <CardDescription>Where the fan's pressure actually goes</CardDescription>
      </CardHeader>
      <CardContent>
        <DuctStatic items={items} fanPa={900} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The ductwork never changes and the filters always do <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          900 Pa fan
        </div>
      </CardFooter>
    </Card>
  )
}

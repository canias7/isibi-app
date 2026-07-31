import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThermalExpansion } from "@/components/charts/lib/materials"
const materials = [
  { name: "Aluminium", alphaPerK: 23.1e-6 },
  { name: "Steel", alphaPerK: 12.0e-6 },
  { name: "Glass", alphaPerK: 8.5e-6 },
  { name: "Invar", alphaPerK: 1.2e-6 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Differential expansion</CardTitle>
        <CardDescription>What a joint has to absorb</CardDescription>
      </CardHeader>
      <CardContent>
        <ThermalExpansion materials={materials} fromC={-10} toC={60} lengthMm={2000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The mismatch cracks the joint <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          2 m run
        </div>
      </CardFooter>
    </Card>
  )
}

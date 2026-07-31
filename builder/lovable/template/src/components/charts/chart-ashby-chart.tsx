import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AshbyChart } from "@/components/charts/lib/materials"
const materials = [
  { name: "Steel", x: 7850, y: 210 }, { name: "Aluminium", x: 2700, y: 70 },
  { name: "Titanium", x: 4500, y: 116 }, { name: "CFRP", x: 1600, y: 150 },
  { name: "Oak", x: 700, y: 12 }, { name: "Concrete", x: 2400, y: 30 },
  { name: "Nylon", x: 1140, y: 3 }, { name: "Alumina", x: 3900, y: 380 },
  { name: "Balsa", x: 160, y: 3.5 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Material selection</CardTitle>
        <CardDescription>Stiffness against density</CardDescription>
      </CardHeader>
      <CardContent>
        <AshbyChart
          materials={materials}
          xLabel="density kg/m³"
          yLabel="Young's modulus GPa"
          index={{ slope: 2, through: { x: 2700, y: 70 } }}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The index line decides, not the position <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Log-log
        </div>
      </CardFooter>
    </Card>
  )
}

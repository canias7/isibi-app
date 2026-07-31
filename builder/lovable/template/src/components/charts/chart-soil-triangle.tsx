import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SoilTriangle } from "@/components/charts/lib/agri"
const samples = [
  { name: "Home", sand: 42, silt: 38, clay: 20 },
  { name: "Brook", sand: 18, silt: 52, clay: 30 },
  { name: "Hill", sand: 74, silt: 18, clay: 8 },
  { name: "Fifteen", sand: 30, silt: 24, clay: 46 },
  { name: "Long Acre", sand: 12, silt: 76, clay: 12 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Soil texture</CardTitle>
        <CardDescription>Sand, silt and clay</CardDescription>
      </CardHeader>
      <CardContent>
        <SoilTriangle samples={samples} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Class derived from the proportions <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five samples
        </div>
      </CardFooter>
    </Card>
  )
}

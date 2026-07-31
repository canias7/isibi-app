import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DepositionFlux } from "@/components/charts/lib/airquality"
const species = [
  { name: "NO₂", concentration: 24, velocityCmS: 0.3, nitrogenFraction: 0.304 },
  { name: "NH₃", concentration: 3.1, velocityCmS: 1.4, nitrogenFraction: 0.822 },
  { name: "HNO₃", concentration: 0.9, velocityCmS: 2.1, nitrogenFraction: 0.222 },
  { name: "SO₂", concentration: 3.6, velocityCmS: 0.7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposition</CardTitle>
        <CardDescription>Annual load computed from concentration and velocity</CardDescription>
      </CardHeader>
      <CardContent>
        <DepositionFlux species={species} criticalLoad={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nitrogen exceeds the critical load <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Lowland heath
        </div>
      </CardFooter>
    </Card>
  )
}

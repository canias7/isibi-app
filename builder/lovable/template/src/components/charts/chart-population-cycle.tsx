import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PopulationCycle } from "@/components/charts/lib/ecology"
const prey = Array.from({ length: 90 }, (_, i) => 40000 + 32000 * Math.sin((i / 10) * Math.PI))
const predator = Array.from({ length: 90 }, (_, i) => 12000 + 8000 * Math.sin(((i - 2.4) / 10) * Math.PI))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Predator and prey</CardTitle>
        <CardDescription>Period and phase lag measured off the series</CardDescription>
      </CardHeader>
      <CardContent>
        <PopulationCycle prey={prey} predator={predator} labels={["1845", "1935"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The lynx trails the hare by two years <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Ninety seasons
        </div>
      </CardFooter>
    </Card>
  )
}

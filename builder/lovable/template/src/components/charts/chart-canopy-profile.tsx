import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CanopyProfile } from "@/components/charts/lib/forestry"
const strata = [
  { fromM: 24, toM: 32, lai: 1.9, species: "Oak crowns" },
  { fromM: 16, toM: 24, lai: 2.4, species: "Oak and ash" },
  { fromM: 8, toM: 16, lai: 1.1, species: "Hazel" },
  { fromM: 2, toM: 8, lai: 0.6, species: "Understorey" },
  { fromM: 0, toM: 2, lai: 0.3, species: "Field layer" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Canopy</CardTitle>
        <CardDescription>Leaf area by stratum, and where the light goes</CardDescription>
      </CardHeader>
      <CardContent>
        <CanopyProfile strata={strata} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One percent reaches the regeneration <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Beer–Lambert
        </div>
      </CardFooter>
    </Card>
  )
}

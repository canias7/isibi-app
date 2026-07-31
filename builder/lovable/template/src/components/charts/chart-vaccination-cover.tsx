import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VaccinationCover } from "@/components/charts/lib/herd"
const groups = [
  { name: "Milking herd", animals: 210, vaccinated: 198 },
  { name: "Dry cows", animals: 46, vaccinated: 41 },
  { name: "Heifers, in calf", animals: 62, vaccinated: 52 },
  { name: "Youngstock", animals: 88, vaccinated: 54 },
  { name: "Bulls", animals: 4, vaccinated: 4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vaccination cover</CardTitle>
        <CardDescription>The threshold derived from R₀ and efficacy</CardDescription>
      </CardHeader>
      <CardContent>
        <VaccinationCover groups={groups} basicReproduction={4.5} vaccineEfficacy={0.88} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One unprotected group exposes the herd <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          R₀ 4.5
        </div>
      </CardFooter>
    </Card>
  )
}

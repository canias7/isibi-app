import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TurnoutByAge } from "@/components/charts/lib/elections"
const cohorts = [
  { band: "18–24", eligible: 5_600_000, voted: 2_460_000 },
  { band: "25–34", eligible: 8_900_000, voted: 4_540_000 },
  { band: "35–44", eligible: 8_200_000, voted: 4_920_000 },
  { band: "45–54", eligible: 8_800_000, voted: 5_980_000 },
  { band: "55–64", eligible: 7_900_000, voted: 5_930_000 },
  { band: "65+", eligible: 11_400_000, voted: 9_240_000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnout by age</CardTitle>
        <CardDescription>Bar width is cohort size, height is turnout</CardDescription>
      </CardHeader>
      <CardContent>
        <TurnoutByAge cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          High turnout in a small cohort is few votes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six bands
        </div>
      </CardFooter>
    </Card>
  )
}

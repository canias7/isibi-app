import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HerdStructure } from "@/components/charts/lib/agri"
const groups = [
  { name: "Calves", ageFrom: 0, ageTo: 6, head: 52 },
  { name: "Weaned", ageFrom: 6, ageTo: 12, head: 46 },
  { name: "Yearlings", ageFrom: 12, ageTo: 24, head: 41 },
  { name: "Heifers in calf", ageFrom: 24, ageTo: 30, head: 38, breeding: true },
  { name: "Cows, 1st lactation", ageFrom: 30, ageTo: 48, head: 74, breeding: true },
  { name: "Cows, mature", ageFrom: 48, ageTo: 96, head: 168, breeding: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Herd by age</CardTitle>
        <CardDescription>Breeding stock and replacements</CardDescription>
      </CardHeader>
      <CardContent>
        <HerdStructure groups={groups} targetReplacementRate={0.55} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Replacement rate is what holds the herd <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Dairy
        </div>
      </CardFooter>
    </Card>
  )
}

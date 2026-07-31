import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarrelProgram } from "@/components/charts/lib/winery"
const regimes = [
  { name: "New French, tight grain", barrels: 42, costEach: 1080, lifeFills: 3, newOakShare: 1 },
  { name: "New American", barrels: 28, costEach: 520, lifeFills: 4, newOakShare: 1 },
  { name: "Second fill French, bought in", barrels: 66, costEach: 390, lifeFills: 3, newOakShare: 0 },
  { name: "Neutral, 5+ fills", barrels: 90, costEach: 240, lifeFills: 6, newOakShare: 0 },
  { name: "Puncheon, new", barrels: 12, costEach: 1950, lifeFills: 4, newOakShare: 1 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Barrel programme</CardTitle>
        <CardDescription>Amortised over fills, not charged to a vintage</CardDescription>
      </CardHeader>
      <CardContent>
        <BarrelProgram regimes={regimes} bottlesPerBarrel={300} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A pricing decision made in the barrel hall <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Annual oak
        </div>
      </CardFooter>
    </Card>
  )
}

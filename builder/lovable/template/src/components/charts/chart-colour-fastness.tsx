import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ColourFastness } from "@/components/charts/lib/textile"
const tests = [
  { name: "Washing", grade: 4 },
  { name: "Rubbing, dry", grade: 4 },
  { name: "Rubbing, wet", grade: 3 },
  { name: "Light", grade: 5 },
  { name: "Perspiration", grade: 4 },
  { name: "Water", grade: 3 },
]
const endUses: { name: string; minimums: Record<string, number> }[] = [
  { name: "Outerwear", minimums: { Washing: 3, Light: 5, Water: 3 } },
  { name: "Shirting", minimums: { Washing: 4, "Rubbing, wet": 3, Perspiration: 4 } },
  { name: "Upholstery", minimums: { Light: 5, "Rubbing, dry": 4, "Rubbing, wet": 4 } },
  { name: "Babywear", minimums: { Washing: 4, Perspiration: 4, "Rubbing, wet": 4, Water: 4 } },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Colour fastness</CardTitle>
        <CardDescription>The same cloth against each end use</CardDescription>
      </CardHeader>
      <CardContent>
        <ColourFastness tests={tests} endUses={endUses} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A grade is not a pass on its own <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Grey scale, 1 to 5
        </div>
      </CardFooter>
    </Card>
  )
}
